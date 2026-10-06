// Private R2 storage; Resend credentials stay in Worker secrets.
const MAX_FILE = 20 * 1024 * 1024;
const MAX_BODY = MAX_FILE + 128 * 1024;
const fields = ['product', 'standard', 'diameter', 'length', 'thread_pitch', 'material', 'property_class', 'surface_treatment', 'quantity', 'destination', 'message', 'name', 'email', 'product_id', 'language'];
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const key = (id) => `rfq/records/${id}.json`;
const pending = (id) => `rfq/pending/${id}`;
const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '');
const save = (bucket, record) => bucket.put(key(record.id), JSON.stringify(record), { httpMetadata: { contentType: 'application/json' } });

async function boundedForm(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('large'); }
    chunks.push(value);
  }
  return new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
}

export async function sendNotification(record, env, send = fetch) {
  if (!env.RESEND_API_KEY || !env.RFQ_FROM) return false;
  const lines = fields.filter((field) => record.fields[field]).map((field) => `${field}: ${record.fields[field]}`);
  if (record.attachment) lines.push(`Drawing: ${record.attachment.name}\n${record.origin}/api/rfq/attachment/${record.id}?token=${record.attachment.token}\nLink expires: ${record.attachment.expires}`);
  const response = await send('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `rfq-${record.id}` },
    body: JSON.stringify({ from: env.RFQ_FROM, to: ['info@nearfastener.com'], reply_to: record.fields.email, subject: `Near Fastener RFQ ${record.id} — ${record.fields.product.replace(/[\r\n]/g, ' ').slice(0, 100)}`, text: `New factory enquiry\nReference: ${record.id}\nReceived: ${record.created}\n\n${lines.join('\n\n')}` }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return false;
  const result = await response.json();
  if (!result.id) return false;
  record.emailId = result.id;
  return true;
}

async function notify(record, env, send) {
  // Preserve the same request body and key for provider idempotency (24-hour window).
  if (Date.now() - Date.parse(record.created) > 23 * 3600000) {
    record.status = 'review-required';
    await save(env.RFQ_STORAGE, record);
    await env.RFQ_STORAGE.delete(pending(record.id));
    return false;
  }
  let sent = false;
  try { sent = await sendNotification(record, env, send); } catch { /* Durable pending record is retried. */ }
  if (sent) {
    record.status = 'notified';
    await save(env.RFQ_STORAGE, record);
    await env.RFQ_STORAGE.delete(pending(record.id));
  }
  return sent;
}

export async function handleRfq(request, env, send = fetch) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/rfq/attachment/')) {
    if (request.method !== 'GET') return json({ error: 'method' }, 405);
    const id = url.pathname.split('/').pop();
    if (!validId(id) || !env.RFQ_STORAGE) return json({ error: 'not_found' }, 404);
    const object = await env.RFQ_STORAGE.get(key(id));
    const record = object ? await object.json() : null;
    const attachment = record?.attachment;
    if (!attachment || url.searchParams.get('token') !== attachment.token || Date.parse(attachment.expires) < Date.now()) return json({ error: 'not_found' }, 404);
    const file = await env.RFQ_STORAGE.get(attachment.key);
    if (!file) return json({ error: 'not_found' }, 404);
    return new Response(file.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
  }
  if (url.pathname !== '/api/rfq') return null;
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'origin' }, 403);
  if (!env.RFQ_STORAGE || !env.RESEND_API_KEY || !env.RFQ_FROM) return json({ error: 'not_configured' }, 503);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) return json({ error: 'invalid' }, 400);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return json({ error: 'too_large' }, 413);
  let form;
  try { form = await boundedForm(request); } catch (error) { return json({ error: error.message === 'large' ? 'too_large' : 'invalid' }, error.message === 'large' ? 413 : 400); }
  if (form.get('website')) return json({ error: 'invalid' }, 400);
  const values = {};
  for (const field of fields) {
    const value = form.get(field) ?? '';
    if (typeof value !== 'string' || value.length > (field === 'message' ? 5000 : 300)) return json({ error: 'invalid' }, 400);
    values[field] = value.trim();
  }
  if (['product', 'quantity', 'name', 'email'].some((field) => !values[field]) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || /[\r\n]/.test(values.email)) return json({ error: 'invalid' }, 400);
  const id = form.get('submission_id');
  if (!validId(id)) return json({ error: 'invalid' }, 400);
  const bucket = env.RFQ_STORAGE;
  const existing = await bucket.get(key(id));
  if (existing) {
    // Retry returns the persisted result without adding a second inquiry or email.
    const record = await existing.json();
    return json({ id, status: record.status === 'notified' ? 'notified' : 'queued' });
  }
  const file = form.get('drawing');
  if (file && typeof file !== 'string' && file.size) {
    if (file.size > MAX_FILE) return json({ error: 'too_large' }, 413);
    if (!/\.(pdf|dwg|dxf|xls|xlsx|doc|docx|jpg|jpeg|png)$/i.test(file.name)) return json({ error: 'invalid_file' }, 400);
  } else if (typeof file === 'string' && file) return json({ error: 'invalid_file' }, 400);
  const record = { id, created: new Date().toISOString(), origin: url.origin, fields: values, status: 'queued' };
  if (file && typeof file !== 'string' && file.size) {
    record.attachment = { key: `rfq/drawings/${id}`, name: file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200), token: crypto.randomUUID() + crypto.randomUUID(), expires: new Date(Date.now() + 30 * 86400000).toISOString() };
  }
  try {
    const claimed = await bucket.put(key(id), JSON.stringify(record), { onlyIf: { etagDoesNotMatch: '*' } });
    if (!claimed) return json({ error: 'retry' }, 409);
    if (record.attachment) await bucket.put(record.attachment.key, await file.arrayBuffer());
    await bucket.put(pending(id), id);
  } catch {
    await Promise.allSettled([bucket.delete(key(id)), bucket.delete(pending(id)), bucket.delete(`rfq/drawings/${id}`)]);
    return json({ error: 'storage' }, 503);
  }
  try { await notify(record, env, send); } catch { /* Already saved; cron retries with the same email key. */ }
  return json({ id, status: record.status === 'notified' ? 'notified' : 'queued' }, 201);
}

export async function retryRfq(env, send = fetch) {
  if (!env.RFQ_STORAGE || !env.RESEND_API_KEY || !env.RFQ_FROM) return;
  const items = await env.RFQ_STORAGE.list({ prefix: 'rfq/pending/', limit: 50 });
  for (const item of items.objects) {
    const object = await env.RFQ_STORAGE.get(key(item.key.split('/').pop()));
    if (!object) { await env.RFQ_STORAGE.delete(item.key); continue; }
    const record = await object.json();
    if (record.status === 'notified') { await env.RFQ_STORAGE.delete(item.key); continue; }
    await notify(record, env, send);
  }
}
