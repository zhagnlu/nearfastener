import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRfq, retryRfq } from '../worker/rfq.mjs';

function storage() {
  const data = new Map();
  return {
    data,
    async put(key, value, options) {
      if (options?.onlyIf && data.has(key)) return null;
      data.set(key, value);
      return { etag: 'saved' };
    },
    async get(key) {
      if (!data.has(key)) return null;
      const value = data.get(key);
      return { body: value, json: async () => JSON.parse(value) };
    },
    async delete(key) { data.delete(key); },
    async list({ prefix, limit }) { return { objects: [...data.keys()].filter((key) => key.startsWith(prefix)).slice(0, limit).map((key) => ({ key })) }; },
  };
}
const id = '10000000-0000-4000-8000-000000000001';
const env = () => ({ RFQ_STORAGE: storage(), RESEND_API_KEY: 'test-only', RFQ_FROM: 'Factory <quotes@example.com>' });
function request(changes = {}, origin = 'https://factory.example') {
  const form = new FormData();
  for (const [name, value] of Object.entries({ product: 'SEMS screws', quantity: '5000', name: 'Buyer', email: 'buyer@example.org', submission_id: id, ...changes })) form.set(name, value);
  return new Request('https://factory.example/api/rfq', { method: 'POST', headers: { Origin: origin }, body: form });
}
const sent = async () => Response.json({ id: 'email-test' });

test('missing setup blocks collection and email without claiming success', async () => {
  const response = await handleRfq(request(), { RFQ_STORAGE: storage() }, () => assert.fail('No email allowed'));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'not_configured');
});
test('required fields, bad emails, cross-origin and honeypot fail before saving', async () => {
  for (const req of [request({ product: '' }), request({ email: 'bad' }), request({ website: 'spam' }), request({}, 'https://other.example')]) {
    const bindings = env();
    assert.ok((await handleRfq(req, bindings, sent)).status >= 400);
    assert.equal(bindings.RFQ_STORAGE.data.size, 0);
  }
});
test('saves specs and drawing, emails only fixed recipient with customer Reply-To, and suppresses duplicate submissions', async () => {
  const bindings = env(); let calls = 0;
  const send = async (url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(url, 'https://api.resend.com/emails');
    assert.deepEqual(body.to, ['info@nearfastener.com']);
    assert.equal(body.reply_to, 'buyer@example.org');
    assert.match(body.text, /quantity: 5000/);
    assert.match(body.text, /company: Assembly Factory/);
    assert.match(body.text, /annual_demand: 60000 pcs/);
    assert.match(body.text, /delivery_schedule: Monthly batches/);
    assert.match(body.text, /api\/rfq\/attachment\//);
    assert.equal(options.headers['Idempotency-Key'], `rfq-${id}`);
    return sent();
  };
  const response = await handleRfq(request({ drawing: new File(['drawing bytes'], 'drawing.pdf'), company: 'Assembly Factory', annual_demand: '60000 pcs', delivery_schedule: 'Monthly batches' }), bindings, send);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, 'notified');
  const record = JSON.parse(bindings.RFQ_STORAGE.data.get(`rfq/records/${id}.json`));
  assert.equal(record.fields.product, 'SEMS screws');
  assert.ok(bindings.RFQ_STORAGE.data.has(record.attachment.key));
  assert.ok(!bindings.RFQ_STORAGE.data.has(`rfq/pending/${id}`));
  assert.equal((await (await handleRfq(request(), bindings, send)).json()).status, 'notified');
  assert.equal(calls, 1);
});
test('mail failure keeps record and drawing pending and cron retries with the same key', async () => {
  const bindings = env();
  assert.equal((await (await handleRfq(request(), bindings, async () => new Response('', { status: 503 }))).json()).status, 'queued');
  assert.ok(bindings.RFQ_STORAGE.data.has(`rfq/pending/${id}`));
  await retryRfq(bindings, sent);
  assert.equal(JSON.parse(bindings.RFQ_STORAGE.data.get(`rfq/records/${id}.json`)).status, 'notified');
  assert.ok(!bindings.RFQ_STORAGE.data.has(`rfq/pending/${id}`));
});
test('attachments require secret link, force download and stop working after expiry', async () => {
  const bindings = env();
  await handleRfq(request({ drawing: new File(['drawing bytes'], 'drawing.pdf') }), bindings, sent);
  const record = JSON.parse(bindings.RFQ_STORAGE.data.get(`rfq/records/${id}.json`));
  const path = `https://factory.example/api/rfq/attachment/${id}`;
  assert.equal((await handleRfq(new Request(path), bindings)).status, 404);
  const response = await handleRfq(new Request(`${path}?token=${record.attachment.token}`), bindings);
  assert.equal(await response.text(), 'drawing bytes');
  assert.match(response.headers.get('Content-Disposition'), /^attachment;/);
  record.attachment.expires = '2000-01-01';
  bindings.RFQ_STORAGE.data.set(`rfq/records/${id}.json`, JSON.stringify(record));
  assert.equal((await handleRfq(new Request(`${path}?token=${record.attachment.token}`), bindings)).status, 404);
});
test('rejects disallowed attachments and oversized request streams', async () => {
  const bindings = env();
  assert.equal((await handleRfq(request({ drawing: new File(['x'], 'evil.html') }), bindings)).status, 400);
  const oversized = new Request('https://factory.example/api/rfq', { method: 'POST', headers: { Origin: 'https://factory.example', 'Content-Type': 'multipart/form-data; boundary=test' }, body: new Uint8Array(21 * 1024 * 1024) });
  assert.equal((await handleRfq(oversized, bindings)).status, 413);
  assert.equal(bindings.RFQ_STORAGE.data.size, 0);
});
test('storage failure does not send email or return success', async () => {
  const bindings = env(); bindings.RFQ_STORAGE.put = async () => { throw new Error('offline'); };
  const response = await handleRfq(request(), bindings, () => assert.fail('No email before saving'));
  assert.equal(response.status, 503);
});
test('old pending records are retained for review instead of duplicating email beyond idempotency window', async () => {
  const bindings = env();
  await handleRfq(request(), bindings, async () => { throw new Error('network'); });
  const record = JSON.parse(bindings.RFQ_STORAGE.data.get(`rfq/records/${id}.json`));
  record.created = '2000-01-01';
  bindings.RFQ_STORAGE.data.set(`rfq/records/${id}.json`, JSON.stringify(record));
  await retryRfq(bindings, () => assert.fail('Do not risk duplicate mail'));
  assert.equal(JSON.parse(bindings.RFQ_STORAGE.data.get(`rfq/records/${id}.json`)).status, 'review-required');
});
