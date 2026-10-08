import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const code = await readFile(new URL('../public/site.js', import.meta.url), 'utf8');
const sandbox = { document: { readyState: 'loading', addEventListener() {} } };
runInNewContext(code, sandbox);
test('contact draft fixes the recipient and encodes all customer input as message data', () => {
  const values = { name: '采购负责人', email: 'buyer@example.org', subject: 'RFQ &bcc=other@example.com', message: 'Line 1\nSEMS 螺丝 & quantity=5000' };
  const url = new URL(sandbox.contactEmailDraft(values));
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, 'info@nearfastener.com');
  assert.equal(url.searchParams.get('subject'), values.subject);
  assert.equal(url.searchParams.has('bcc'), false);
  assert.ok(url.searchParams.get('body').includes(values.message));
  assert.ok(url.searchParams.get('body').includes(values.email));
});
test('contact form labels explain the email app handoff and do not claim backend sending', async () => {
  const html = await readFile(new URL('../content/pages/contact.html', import.meta.url), 'utf8');
  assert.match(html, />Open Email Draft<\/button>/);
  assert.match(html, /This opens your email app/);
  assert.doesNotMatch(html, />Send Message<\/button>/);
});
