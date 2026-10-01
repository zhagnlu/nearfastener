import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import test from 'node:test';
import { resourcePages } from '../scripts/resources.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(await readFile(join(root, 'content/resources.json'), 'utf8'));
const catalog = JSON.parse(await readFile(join(root, 'content/catalog.json'), 'utf8'));
const routes = JSON.parse(await readFile(join(root, 'content/routes.json'), 'utf8'));

test('resource pages retain existing article URLs and render complete linked guides', async () => {
  const pages = resourcePages(data, catalog);
  for (const id of ['bolt-property-classes', 'gb-t-32076-7-guide', 'surface-treatment-comparison', '42crmo-material-guide']) assert.ok(pages.has(`/resources/${id}`));
  for (const [path, { html, file }] of pages) {
    assert.equal(await readFile(join(root, 'content/pages', file), 'utf8'), html);
    assert.doesNotMatch(html, /placeholder|Article content|replace with real/i);
    for (const [, href] of html.matchAll(/href="(\/[^"?#]*)/g)) assert.ok(routes[href], `${path}: ${href}`);
    for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${anchor}"`), anchor);
    if (path !== '/resources') {
      assert.ok(html.includes('class="blog-toc"'));
      assert.ok(html.includes('class="blog-related"'));
      assert.ok(html.includes('href="/rfq"'));
    }
  }
});

test('resource input rejects broken topics, products, sources, paths and duplicate anchors', () => {
  for (const [mutate, expected] of [
    [(d) => { d.articles[0].topic = 'unknown'; }, /metadata/],
    [(d) => { d.articles[0].relatedProducts = ['missing']; }, /related product/],
    [(d) => { d.articles[0].sections[0].sources = ['missing']; }, /article source/],
    [(d) => { d.articles[0].image = '/assets/../secret.png'; }, /article image/],
    [(d) => { d.articles[0].sections[1].id = d.articles[0].sections[0].id; }, /article section/],
    [(d) => { d.articles[0].sources[0].url = 'javascript:alert(1)'; }, /article source/],
  ]) {
    const copy = structuredClone(data); mutate(copy);
    assert.throws(() => resourcePages(copy, catalog), expected);
  }
});

test('article bodies and interface text have translated content in all supported languages', async () => {
  for (const code of ['zh-CN', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'ja']) {
    const dictionary = JSON.parse(await readFile(join(root, 'content/locales', `${code}.json`), 'utf8'));
    for (const article of data.articles) {
      for (const text of [article.summary, ...article.sections.flatMap((section) => [section.title, ...section.paragraphs])]) {
        assert.ok(dictionary[text]?.trim(), `${code}: ${text}`);
        assert.notEqual(dictionary[text], text, `${code}: untranslated content`);
      }
    }
  }
});

test('exported articles resolve offline images, product links, and RFQ links', async () => {
  for (const { file } of resourcePages(data, catalog).values()) {
    const page = join(root, 'static-site', file.replace(/\.html$/, '/index.html'));
    const html = await readFile(page, 'utf8');
    for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(https?:|#)/.test(value)) continue;
      await access(resolve(dirname(page), value.split(/[?#]/)[0]));
    }
    assert.equal((html.match(/class="whatsapp-float"/g) ?? []).length, 1);
  }
});
