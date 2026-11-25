import { languages, splitLocalePath } from '../scripts/localization.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pageSeo, safeJson, siteOrigin, sitemapXml, robotsTxt } from '../scripts/seo.mjs';
const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
const settings = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
const site = { ...settings, url: 'https://factory.example' };

test('the real production configuration keeps its confirmed origin', () => {
  assert.equal(siteOrigin(settings), 'https://www.nearfastener.com');
});

test('static export rejects a missing or invalid origin before touching generated files', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'nearfastener-export-origin-'));
  try {
    await cp(new URL('../scripts/', import.meta.url), join(fixture, 'scripts'), { recursive: true });
    await mkdir(join(fixture, 'content'));
    // product-support imports this read-only data before the entry point runs.
    await cp(new URL('../content/resources.json', import.meta.url), join(fixture, 'content/resources.json'));
    await mkdir(join(fixture, 'static-site'));
    const previous = join(fixture, 'static-site', 'index.html');
    await writeFile(previous, 'previous export');
    for (const url of [null, 'http://www.nearfastener.com', 'https://www.nearfastener.com/path']) {
      await writeFile(join(fixture, 'content/site.json'), JSON.stringify({ ...settings, url }));
      const result = spawnSync(process.execPath, ['scripts/export-static.mjs'], { cwd: fixture, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /confirmed HTTPS production origin|Site URL must be an HTTPS origin/);
      assert.equal(await readFile(previous, 'utf8'), 'previous export');
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('the real static release includes sitemap, robots and matching SEO for every language page', async () => {
  const root = new URL('../static-site/', import.meta.url);
  const xml = await readFile(new URL('sitemap.xml', root), 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const expected = Object.keys(routes).flatMap(path => languages.map(language => settings.url + '/' + language.toLowerCase() + (path === '/' ? '/' : path + '/')));
  assert.deepEqual([...urls].sort(), expected.sort());
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(await readFile(new URL('robots.txt', root), 'utf8'), robotsTxt(settings));
  for (const url of urls) {
    const pathname = new URL(url).pathname;
    const { language, path } = splitLocalePath(pathname);
    assert.ok(routes[path], url);
    const html = await readFile(new URL(pathname.slice(1) + 'index.html', root), 'utf8');
    const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])));
    assert.deepEqual(links.filter(link => link.rel === 'canonical').map(link => link.href), [url], url);
    const alternates = links.filter(link => link.rel === 'alternate');
    assert.equal(alternates.length, languages.length + 1, url);
    for (const code of [...languages, 'x-default']) {
      const target = settings.url + '/' + (code === 'x-default' ? 'en' : code.toLowerCase()) + (path === '/' ? '/' : path + '/');
      assert.equal(alternates.find(link => link.hreflang === code)?.href, target, `${url}: ${code}`);
      assert.ok(urls.includes(target), target);
    }
    assert.ok(html.includes(`<html lang="${language}"`), url);
    assert.ok(!/<meta\b[^>]*name="robots"[^>]*noindex/.test(html), url);
    assert.ok(html.includes(`property="og:url" content="${url}"`), url);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];
    const page = graph.find(item => ['WebPage', 'ItemPage', 'CollectionPage'].includes(item['@type']));
    assert.equal(page.url, url, url);
    assert.equal(page.inLanguage, language, url);
    for (const crumb of graph.find(item => item['@type'] === 'BreadcrumbList')?.itemListElement || []) {
      assert.ok(crumb.item.startsWith(settings.url + '/' + language.toLowerCase() + '/'), url);
    }
  }
  for (const path of ['/', '/products', '/product/sems-screw']) {
    const html = await readFile(new URL((path === '/' ? '' : path.slice(1) + '/') + 'index.html', root), 'utf8');
    assert.match(html, /name="robots" content="noindex"/);
    assert.ok(!urls.includes(settings.url + path), 'Legacy aliases must not enter sitemap');
  }
});

test('sitemap enumerates every real route once without API or parameter URLs', () => {
  const xml = sitemapXml(routes, site);
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(urls.length, Object.keys(routes).length * languages.length);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.ok(routes[splitLocalePath(new URL(url).pathname).path]);
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
  const html = await readFile(new URL('../static-site/en/product/sems-screw/index.html', import.meta.url), 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(data['@graph'].find((item) => item['@type'] === 'Product').name, product.title);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
});

test('language SEO localizes visible fields without translating schema vocabulary', async () => {
  const { readCatalog } = await import('../scripts/build-locales.mjs');
  const product = catalog.products.find(item => item.status === 'published');
  for (const language of languages) {
    const dictionary = await readCatalog(language);
    const seo = pageSeo(product.path, routes[product.path], catalog, site, routes, language, dictionary);
    assert.equal(seo.canonical, site.url + '/' + language.toLowerCase() + product.path + '/');
    assert.equal(seo.alternates.length, 10);
    const graph = seo.structuredData['@graph'];
    const data = graph.find(item => item['@type'] === 'Product');
    assert.ok(data, language + ': schema type must remain Product');
    assert.equal(data.name, dictionary[product.title] || product.title);
    assert.equal(data.image, site.url + product.image);
    assert.equal(graph.find(item => item['@type'] === 'ItemPage').inLanguage, language);
    assert.equal(graph.find(item => item['@type'] === 'BreadcrumbList').itemListElement.at(-1).item, seo.canonical);
  }
});
