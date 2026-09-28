import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { languages, root, readCatalog } from '../scripts/build-locales.mjs';

const decode = (value) => value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
  if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
  if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[entity.toLowerCase()];
});

test('all 49 pages, shared fragments, and metadata are covered by the English catalog', async () => {
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

test('offline script packs register precisely the source dictionary without remote code', async () => {
  for (const code of languages) {
    let registered;
    let dictionary;
    const context = { window: { NearFastenerI18n: { register: (language, data) => { registered = language; dictionary = data; } } } };
    vm.runInNewContext(await readFile(join(root, `public/locales/${code}.js`), 'utf8'), context);
    assert.equal(registered, code);
    assert.deepEqual(JSON.parse(JSON.stringify(dictionary)), await readCatalog(code));
  }
});
