import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { localizedPath, resolvePageRequest, localizeHtml } from '../scripts/localization.mjs';
import test from 'node:test';
import { languages, root, readCatalog } from '../scripts/build-locales.mjs';

const decode = (value) => value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
  if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
  if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[entity.toLowerCase()];
});

test('all configured pages, shared fragments, and metadata are covered by the English catalog', async () => {
  const english = await readCatalog('en');
  const routes = JSON.parse(await readFile(join(root, 'content/routes.json'), 'utf8'));
  const strings = new Set();
  const files = ['content/header.html', 'content/footer.html', ...Object.values(routes).map(({ file }) => `content/pages/${file}`)];
  for (const file of files) {
    const html = await readFile(join(root, file), 'utf8');
    for (const part of html.split(/<[^>]*>/g)) if (part.trim()) strings.add(decode(part.trim()));
    for (const [, value] of html.matchAll(/(?:placeholder|alt|aria-label|title)="([^"]*)"/g)) if (value.trim()) strings.add(decode(value.trim()));
  }
  for (const meta of Object.values(routes)) { strings.add(meta.title); strings.add(meta.description); }
  for (const value of strings) assert.ok(Object.hasOwn(english, value), `Add translations for: ${value}`);
});

test('every language has complete dictionaries and preserves technical identifiers', async () => {
  const english = await readCatalog('en');
  const invariants = await readCatalog('invariants');
  const expected = Object.keys(english).sort();
  for (const code of languages) {
    const dictionary = await readCatalog(code);
    assert.deepEqual(Object.keys(dictionary).sort(), expected, code);
    for (const key of expected) assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), `${code}: ${key}`);
    for (const key of invariants) assert.equal(dictionary[key], key, `${code}: identifier ${key}`);
    for (const key of ['Our Story', 'Send Message', 'Specifications', 'Quality Control']) {
      if (code !== 'en') assert.notEqual(dictionary[key], english[key], `${code}: untranslated ${key}`);
    }
  }
});

test('every route has nine complete HTML pages without runtime translation packs', async () => {
  const routes = JSON.parse(await readFile(join(root, 'content/routes.json'), 'utf8'));
  for (const code of languages) {
    const dictionary = await readCatalog(code);
    for (const [path, page] of Object.entries(routes)) {
      const html = await readFile(join(root, 'static-site', localizedPath(path, code), 'index.html'), 'utf8');
      assert.ok(html.includes(`<html lang="${code}" dir="${code === 'ar' ? 'rtl' : 'ltr'}">`));
      assert.ok(html.includes(dictionary[page.title].replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')));
      assert.ok(!html.includes('i18n.js') && !html.includes('/locales/'));
      const links = [...html.matchAll(/data-language="([^"]+)"/g)];
      assert.equal(links.length, languages.length, `${code} ${path}`);
      for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (target.startsWith('#') || /^[a-z]+:/i.test(target)) continue;
        const file = new URL(target, 'file://' + join(root, 'static-site', localizedPath(path, code), 'index.html'));
        await readFile(file).catch(error => { throw new Error(`${code} ${path}: broken link ${target}: ${error.message}`); });
      }
    }
  }
});
test('language routing migrates old addresses and preserves query data', () => {
  const routes = { '/': {}, '/products': {} };
  for (const [path, search, expected] of [
    ['/', '', '/en/'], ['/products', '?lang=zh-CN&topic=all', '/zh-cn/products/?topic=all'],
    ['/de/products/index.html', '?lang=ja&product_id=test', '/de/products/?product_id=test'],
    ['/EN/products', '', '/en/products/'],
  ]) assert.equal(resolvePageRequest(path, search, routes).redirect, expected);
  assert.equal(resolvePageRequest('/ja/products/', '', routes).redirect, null);
  assert.equal(resolvePageRequest('/xx/products/', '', routes), null);
  assert.equal(resolvePageRequest('/ja/missing/', '', routes), null);
});
test('rendering escapes translations and localizes internal links only', () => {
  const html = localizeHtml('<p>Hello</p><img alt="Hello" src="/assets/a.jpg"><a href="/rfq?product_id=x#form">Hello</a>', 'de', { Hello: '<Hallo & Welt>' }, { '/rfq': {} });
  assert.match(html, /&lt;Hallo &amp; Welt&gt;/);
  assert.match(html, /href="\/de\/rfq\/\?product_id=x#form"/);
  assert.match(html, /src="\/assets\/a.jpg"/);
});
