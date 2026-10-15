import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { pageSeo } from '../scripts/seo.mjs';
import catalog from '../content/catalog.json' with { type: 'json' };
import site from '../content/site.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));
const routes = JSON.parse(await readFile(join(root, 'content/routes.json'), 'utf8'));
const assets = JSON.parse(await readFile(join(root, 'content/assets.json'), 'utf8'));

test('every captured page has content and every internal link has a destination', async () => {
  assert.ok(Object.keys(routes).length > 0);
  for (const [path, page] of Object.entries(routes)) {
    const html = await readFile(join(root, 'content/pages', page.file), 'utf8');
    assert.match(html, /<h1\b/, path);
    assert.match(html, /id="main-content"/, path);
    assert.doesNotMatch(html, /<script|data-component-|wanwang\.xin|opacity-0 /, path);
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) assert.ok(routes[href], `${path} links to missing ${href}`);
    for (const [, src] of html.matchAll(/src="([^"]+)"/g)) {
      assert.ok(src.startsWith('/assets/'), `${path}: external image ${src}`);
      await access(join(root, 'public', src));
    }
  }
});

test('all 44 original images have valid local bitmap data', async () => {
  assert.equal(Object.keys(assets).length, 44);
  for (const path of Object.values(assets)) {
    const buffer = await readFile(join(root, 'public', path));
    assert.ok(buffer.length > 1000, `${path} is empty or truncated`);
    const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
    const png = buffer.subarray(1, 4).toString() === 'PNG';
    const webp = buffer.subarray(8, 12).toString() === 'WEBP';
    assert.ok(jpeg || png || webp, `${path} is not a bitmap image`);
  }
});

test('the deployable worker renders every configured route and returns 404 for unknown pages', async () => {
  const { default: worker } = await import('../dist/server/index.js');
  const env = { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } };
  const context = { waitUntil() {}, passThroughOnException() {} };
  for (const [path, page] of Object.entries(routes)) {
    const response = await worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: 'text/html' } }), env, context);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes(pageSeo(path, page, catalog, site, routes).title.replaceAll('&', '&amp;')), `${path} has wrong metadata`);
    assert.match(html, /id="main-content"/, path);
    assert.match(html, /Near Fastener/, path);
    assert.doesNotMatch(html, /Your site is taking shape|codex-preview/, path);
  }
  const missing = await worker.fetch(new Request('http://localhost/this-page-does-not-exist'), env, context);
  assert.equal(missing.status, 404);
});

test('built worker exposes RFQ API and does not report success without setup', async () => {
  const { default: worker } = await import('../dist/server/index.js');
  const response = await worker.fetch(new Request('https://factory.example/api/rfq', { method: 'POST', headers: { Origin: 'https://factory.example' } }), {}, {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'not_configured');
  assert.equal(typeof worker.scheduled, 'function');
});
