import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { catalogPages, productsForCategory, validateCatalog } from '../scripts/catalog.mjs';

const source = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(source);

test('existing product and category routes remain represented once in the catalog', () => {
  validateCatalog(source, routes);
  const pages = catalogPages(source, routes);
  for (const path of Object.keys(routes)) {
    if (path.startsWith('/products/')) assert.ok(pages.has(path), path);
    if (path.startsWith('/product/')) assert.equal(source.products.filter((product) => product.path === path).length, 1, path);
  }
  assert.ok(source.categories.find((category) => category.id === 'hex-bolts').aliases.includes('外六角螺丝'));
});

test('draft expansion categories never appear as public links or routes', () => {
  const catalog = fresh();
  catalog.categories.push({ id: 'future-screws', path: '/products/future-screws', title: 'Future Screws', description: '', status: 'draft', kind: 'type', aliases: [], parentId: null });
  const pages = catalogPages(catalog, routes);
  for (const id of ['future-screws']) {
    assert.equal(pages.has(`/products/${id}`), false);
    for (const { html } of pages.values()) assert.ok(!html.includes(`href="/products/${id}"`));
  }
});

test('one countersunk hex-socket product can belong to two categories and is counted once in their parent', () => {
  const catalog = fresh();
  catalog.products = catalog.products.filter((product) => !product.detail);
  const parent = { id: 'screws', path: '/products/screws', title: 'Screws', description: 'Screw products.', status: 'published', parentId: null, aliases: [], kind: 'type' };
  Object.assign(catalog.categories.find((category) => category.id === parent.id), parent);
  for (const category of catalog.categories.filter((item) => ['countersunk-screws', 'hex-socket-screws'].includes(item.id))) {
    Object.assign(category, { status: 'published', description: category.title, parentId: parent.id });
  }
  const product = { id: 'sample-screw', path: '/product/sample-screw', title: 'Sample Screw', description: 'Sample.', status: 'published', primaryCategoryId: 'countersunk-screws', categoryIds: ['countersunk-screws', 'hex-socket-screws'], attributes: { headStyle: ['countersunk'], driveType: ['hex-socket'] } };
  catalog.products.push(product);
  const pages = catalogPages(catalog, { ...routes, [product.path]: { file: 'product/sample-screw.html' } });
  assert.equal(productsForCategory(catalog, 'screws').length, 1);
  for (const id of ['screws', 'countersunk-screws', 'hex-socket-screws']) assert.equal(pages.get(`/products/${id}`).html.match(/href="\/product\/sample-screw"/g).length, 1);
  assert.ok(pages.get('/products').html.includes('href="/products/screws"'));
  assert.ok(pages.get('/products/countersunk-screws').html.includes('href="/products/screws"'));
});

test('malformed relationships fail before pages are generated', () => {
  for (const [mutate, expected] of [
    [(c) => c.products[0].categoryIds.push('missing'), /Unknown category/],
    [(c) => c.categories[0].parentId = c.categories[0].id, /cycle/],
    [(c) => c.categories[0].parentId = 'missing', /Unknown parent/],
    [(c) => c.categories[1].path = c.categories[0].path, /Duplicate path/],
    [(c) => c.products[0].primaryCategoryId = 'washers', /primary category/],
    [(c) => c.products[0].attributes.driveType = ['unknown'], /attribute value/],
    [(c) => c.products[0].path = '/product/unknown', /Missing product detail/],
    [(c) => c.categories[0].image = 'https://example.com/image.jpg', /Invalid image/],
  ]) {
    const catalog = fresh();
    mutate(catalog);
    assert.throws(() => catalogPages(catalog, routes), expected);
  }
});

test('draft products are excluded and customer-visible copy is escaped', () => {
  const catalog = fresh();
  catalog.products[0].status = 'draft';
  catalog.categories[0].title = '<script>alert("x")</script>';
  const pages = catalogPages(catalog, routes);
  const html = pages.get(catalog.categories[0].path).html;
  assert.ok(!html.includes(`href="${catalog.products[0].path}"`));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('catalog generated pages on disk match the source data', async () => {
  for (const { file, html } of catalogPages(source, routes).values()) {
    assert.equal(await readFile(new URL(`../content/pages/${file}`, import.meta.url), 'utf8'), html, file);
  }
});
