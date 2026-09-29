import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { catalogPages, productsForCategory } from '../scripts/catalog.mjs';
import { rfqContext } from '../scripts/catalog-detail.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
const id = 'hex-socket-countersunk-screw';
const product = catalog.products.find((item) => item.id === id);

test('both classification paths reach one generated product and its standard', () => {
  const pages = catalogPages(catalog, routes);
  assert.match(pages.get('/products').html, /href="\/products\/screws"/);
  for (const category of ['screws', 'countersunk-screws', 'hex-socket-screws']) {
    assert.equal(productsForCategory(catalog, category).filter((item) => item.id === id).length, 1);
    assert.ok(pages.get(`/products/${category}`).html.includes(`href="${product.path}"`));
  }
  const detail = pages.get(product.path).html;
  assert.match(detail, /action="\/rfq" method="get"/);
  assert.match(detail, /name="product_id" value="hex-socket-countersunk-screw"/);
  assert.match(detail, /name="length_unit" value="mm"/);
  assert.match(detail, /href="\/standards\/iso-10642"/);
  assert.ok(pages.get('/standards/iso-10642').html.includes(`href="${product.path}"`));
  assert.match(rfqContext(catalog), /data-rfq-product-id="hex-socket-countersunk-screw"/);
});

test('generated details reject missing or invalid standard references', () => {
  const broken = structuredClone(catalog);
  broken.products.find((item) => item.id === id).standardId = 'unknown';
  assert.throws(() => catalogPages(broken, routes), /Unknown standard/);
  broken.products.find((item) => item.id === id).standardId = 'iso-10642';
  broken.standards[0].sourceUrl = 'javascript:alert(1)';
  assert.throws(() => catalogPages(broken, routes), /Invalid standard source/);
});

test('unpublishing a generated product removes its detail and unreferenced standard', () => {
  const draft = structuredClone(catalog);
  draft.products.find((item) => item.id === id).status = 'draft';
  const pages = catalogPages(draft, routes);
  assert.equal(pages.has(product.path), false);
  assert.equal(pages.has('/standards/iso-10642'), false);
  assert.ok(!rfqContext(draft).includes(`data-rfq-product-id="${id}"`));
});

test('static RFQ action resolves to a real file and retains the product identity', async () => {
  const path = resolve(root, 'static-site', product.path.slice(1), 'index.html');
  const html = await readFile(path, 'utf8');
  const action = html.match(/<form[^>]*action="([^"]+)"[^>]*data-product-request/)[1];
  assert.ok(!action.startsWith('/'), 'Offline form action must be relative');
  const rfq = await readFile(resolve(dirname(path), action), 'utf8');
  assert.match(rfq, /data-preview-form="rfq"/);
  assert.ok(rfq.includes(`data-rfq-product-id="${id}"`));
});
