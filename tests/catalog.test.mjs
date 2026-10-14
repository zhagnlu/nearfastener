import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { catalogPages, productsForCategory, validateCatalog } from '../scripts/catalog.mjs';

const source = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(source);

test('standard variants share family cards while retaining every detail link', () => {
  const page = catalogPages(source, routes).get('/products/hex-bolts').html;
  assert.equal((page.match(/class="catalog-standard-family"/g) ?? []).length, 2);
  for (const id of ['gb-t-5782-hex-bolt', 'din-931-hex-bolt', 'iso-4014-hex-bolt', 'gb-t-5783-hex-bolt', 'din-933-hex-bolt']) {
    assert.ok(page.includes(`href="/product/${id}"`), id);
  }
});

test('expanded public families contain products and new details carry their RFQ identity', () => {
  const pages = catalogPages(source, routes);
  for (const category of source.categories.filter((item) => item.status === 'published' && item.kind !== 'service')) {
    assert.ok(productsForCategory(source, category.id).length, category.id);
  }
  for (const id of ['pan-head-machine-screw', 'self-tapping-screw', 'cone-point-set-screw', 'cup-point-set-screw', 'dog-point-set-screw', 'hex-flange-bolt', 'carriage-bolt', 'anchor-bolt', 'lock-nut', 'flange-nut', 'coupling-nut', 'spring-washer', 'structural-washer']) {
    const html = pages.get(`/product/${id}`).html;
    assert.ok(html.includes(`name="product_id" value="${id}"`), id);
    assert.ok(html.includes(`src="${source.products.find((product) => product.id === id).image}"`), id);
    assert.doesNotMatch(html, /AI-(?:generated|retouched)/, id);
  }
});

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
    [(c) => c.categories[0].image = '/assets/products/../secret.jpg', /Invalid image/],
    [(c) => c.categories[0].image = '/assets/products//screw.jpg', /Invalid image/],
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

test('primary product families partition the catalog while alternate browsing keeps old routes', async () => {
  const roots = source.categories.filter((category) => category.status === 'published' && !category.parentId);
  assert.deepEqual(roots.map((category) => category.id), ['bolts', 'screws', 'nuts', 'studs-and-rods', 'washers', 'custom-fasteners']);
  const pages = catalogPages(source, routes);
  for (const product of source.products.filter((item) => item.status === 'published')) {
    assert.equal(roots.filter((category) => productsForCategory(source, category.id).some((item) => item.id === product.id)).length, 1, product.id);
    const primary = source.categories.find((category) => category.id === product.primaryCategoryId);
    assert.ok(['family', 'drive-type'].includes(primary.navigationGroup ?? 'family'), product.id);
    const html = await readFile(new URL(`../content/pages/${routes[product.path].file}`, import.meta.url), 'utf8');
    const root = roots.find((category) => productsForCategory(source, category.id).some((item) => item.id === product.id));
    assert.ok(html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)[0].includes(`href="${root.path}"`), product.id);
  }
  assert.match(pages.get('/products/bolts').html, /Browse by Strength/);
  assert.match(pages.get('/products/bolts').html, /Browse by Application/);
  assert.match(pages.get('/products/screws').html, /Browse by Head Style/);
  assert.match(pages.get('/products/screws').html, /Browse by Drive Type/);
  assert.equal(source.categories.find((item) => item.id === 'special-bolts').parentId, 'bolts');
});

test('custom manufacturing page supports factory bulk and SEMS inquiries', () => {
  const html = catalogPages(source, routes).get('/products/custom-fasteners').html;
  assert.ok(!html.includes('Products in this category are being updated.'));
  assert.ok(html.includes('Factory Bulk Orders'));
  assert.ok(html.includes('href="/product/sems-screw"'));
  assert.ok(html.includes('href="/rfq"'));
});

test('homepage and footer use the same root categories as the product directory', async () => {
  const expected = source.categories.filter((item) => item.status === 'published' && !item.parentId).map((item) => item.path);
  const footer = await readFile(new URL('../content/footer.html', import.meta.url), 'utf8');
  const home = await readFile(new URL('../content/pages/home.html', import.meta.url), 'utf8');
  const footerProducts = footer.match(/<h4\b[^>]*>Products<\/h4><ul\b[^>]*>([\s\S]*?)<\/ul>/)[1];
  const homeProducts = home.match(/<section\b[^>]*>(?:(?!<section\b)[\s\S])*?Product Categories[\s\S]*?<\/section>/)[0];
  for (const html of [footerProducts, homeProducts]) assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), expected);
});
