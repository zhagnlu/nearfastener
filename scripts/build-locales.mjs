import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const languages = ['en', 'zh-CN', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'ja'];
export const root = fileURLToPath(new URL('../', import.meta.url));
export const readCatalog = async (code) => JSON.parse(await readFile(join(root, 'content/locales', `${code}.json`), 'utf8'));

export async function buildLocales() {
  const english = await readCatalog('en');
  const keys = Object.keys(english).sort();
  const invariants = new Set(await readCatalog('invariants'));
  await mkdir(join(root, 'public/locales'), { recursive: true });
  for (const code of languages) {
    const dictionary = await readCatalog(code);
    if (JSON.stringify(Object.keys(dictionary).sort()) !== JSON.stringify(keys)) throw new Error(`${code}: missing or extra translation keys`);
    for (const key of keys) {
      if (typeof dictionary[key] !== 'string' || !dictionary[key].trim()) throw new Error(`${code}: empty translation for ${key}`);
      if (invariants.has(key) && dictionary[key] !== key) throw new Error(`${code}: identifier changed: ${key}`);
    }
    // JSON encoding keeps text as data. Script wrappers permit offline file:// use without fetch/CORS.
    const encoded = JSON.stringify(dictionary).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
    await writeFile(join(root, 'public/locales', `${code}.js`), `// Generated from content/locales/${code}.json by npm run i18n:build.\nwindow.NearFastenerI18n.register(${JSON.stringify(code)}, ${encoded}, ${JSON.stringify([...invariants])});\n`);
  }
  console.log(`Built ${languages.length} local language packs (${keys.length} entries each).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildLocales();
