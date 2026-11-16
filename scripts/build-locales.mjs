import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export { languages } from './localization.mjs';
import { languages } from './localization.mjs';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const readCatalog = async (code) => JSON.parse(await readFile(join(root, 'content/locales', `${code}.json`), 'utf8'));

export async function buildLocales() {
  const english = await readCatalog('en');
  const keys = Object.keys(english).sort();
  const invariants = new Set(await readCatalog('invariants'));
  for (const code of languages) {
    const dictionary = await readCatalog(code);
    if (JSON.stringify(Object.keys(dictionary).sort()) !== JSON.stringify(keys)) throw new Error(`${code}: missing or extra translation keys`);
    for (const key of keys) {
      if (typeof dictionary[key] !== 'string' || !dictionary[key].trim()) throw new Error(`${code}: empty translation for ${key}`);
      if (invariants.has(key) && dictionary[key] !== key) throw new Error(`${code}: identifier changed: ${key}`);
    }
  }
  console.log(`Validated ${languages.length} build-time translation catalogs (${keys.length} entries each).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildLocales();
