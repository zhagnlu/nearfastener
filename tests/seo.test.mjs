import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageSeo, safeJson, siteOrigin, sitemapXml, robotsTxt } from '../scripts/seo.mjs';
const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
const settings = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
const site = { ...settings, url: 'https://factory.example' };

test('sitemap enumerates every real route once without API or parameter URLs', () => {
  const xml = sitemapXml(routes, site);
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(urls.length, Object.keys(routes).length);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.ok(routes[new URL(url).pathname]);
  assert.ok(urls.every((url) => !url.includes('?') && !url.includes('/api/')));
  assert.match(robotsTxt(site), /Sitemap: https:\/\/factory.example\/sitemap.xml/);
});
test('unconfigured or invalid production domains do not create guessed canonical URLs', () => {
  assert.equal(sitemapXml(routes, { ...site, url: null }), null);
  assert.equal(pageSeo('/', routes['/'], catalog, { ...site, url: null }, routes).canonical, undefined);
  for (const url of ['http://factory.example', 'https://user:password@factory.example', 'https://factory.example/path', 'https://factory.example/?x=1']) assert.throws(() => siteOrigin({ url }));
});
test('product structured data matches primary taxonomy and avoids invented commercial claims', () => {
  for (const product of catalog.products.filter((item) => item.status === 'published')) {
    const seo = pageSeo(product.path, routes[product.path], catalog, site, routes);
    const data = seo.structuredData['@graph'].find((item) => item['@type'] === 'Product');
    assert.equal(data.name, product.title);
    assert.equal(data.image, site.url + product.image);
    for (const key of ['offers', 'aggregateRating', 'review', 'gtin', 'sku']) assert.ok(!(key in data));
    const crumbs = seo.structuredData['@graph'].find((item) => item['@type'] === 'BreadcrumbList').itemListElement;
    assert.equal(crumbs.at(-2).item, site.url + catalog.categories.find((item) => item.id === product.primaryCategoryId).path);
    assert.equal(crumbs.at(-1).item, seo.canonical);
  }
});
test('JSON-LD safely serializes HTML-like user data and exported pages share the schema', async () => {
  assert.ok(!safeJson({ text: '</script><script>alert(1)</script>' }).includes('<'));
  const product = catalog.products.find((item) => item.id === 'sems-screw');
  const html = await readFile(new URL('../static-site/product/sems-screw/index.html', import.meta.url), 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(data['@graph'].find((item) => item['@type'] === 'Product').name, product.title);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
});
