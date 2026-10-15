import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageSeo, safeJson, siteOrigin, sitemapXml, robotsTxt } from '../scripts/seo.mjs';
import { languages, localizedPath, resolveLocalizedPath, translator } from '../scripts/localization.mjs';
import resources from '../content/resources.json' with { type: 'json' };
const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
const settings = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
const site = { ...settings, url: 'https://factory.example' };

test('sitemap enumerates each language and route once with reciprocal alternates', () => {
  const xml = sitemapXml(routes, site);
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(urls.length, Object.keys(routes).length * languages.length);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.ok(routes[resolveLocalizedPath(new URL(url).pathname).path]);
  assert.equal((xml.match(/hreflang="x-default"/g) ?? []).length, urls.length);
  for (const code of languages) assert.equal((xml.match(new RegExp(`hreflang="${code}"`, 'g')) ?? []).length, urls.length);
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
    assert.equal(crumbs.at(-2).item, site.url + catalog.categories.find((item) => item.id === product.primaryCategoryId).path + '/');
    assert.equal(crumbs.at(-1).item, seo.canonical);
  }
});

test('localized canonical, metadata, product entities and alternates agree in every language', () => {
  for (const language of languages) {
    const seenTitles = new Set();
    const seenDescriptions = new Set();
    for (const [path, meta] of Object.entries(routes)) {
      const seo = pageSeo(path, meta, catalog, site, routes, language);
      assert.equal(seo.canonical, site.url + localizedPath(path, language));
      assert.equal(seo.alternates.find(item => item.language === language).url, seo.canonical);
      assert.equal(seo.alternates.length, languages.length + 1);
      assert.ok(!seenTitles.has(seo.title), `${language}: duplicate title ${seo.title}`);
      assert.ok(!seenDescriptions.has(seo.description), `${language}: duplicate description ${seo.description}`);
      seenTitles.add(seo.title); seenDescriptions.add(seo.description);
      const page = seo.structuredData['@graph'].find(item => item['@id'] === seo.canonical + '#webpage');
      assert.equal(page.inLanguage, language);
      const product = seo.structuredData['@graph'].find(item => item['@type'] === 'Product');
      if (product) { assert.equal(product.url, seo.canonical); assert.match(product.image, /^https:\/\//); }
    }
  }
});

test('article entities cite the visible sources and use recorded modification dates', () => {
  for (const article of resources.articles) {
    const path = '/resources/' + article.id;
    const seo = pageSeo(path, routes[path], catalog, site, routes, 'de');
    const data = seo.structuredData['@graph'].find(item => item['@type'] === 'BlogPosting');
    assert.equal(data.headline, translator('de')(article.title));
    assert.equal(data.dateModified, article.updated);
    assert.equal(data.inLanguage, 'de');
    assert.deepEqual(data.citation, article.sources.map(source => source.url));
    assert.equal(data.mainEntityOfPage, seo.canonical);
    assert.equal('datePublished' in data, false);
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
