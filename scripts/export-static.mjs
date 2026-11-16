import { buildSeo } from './build-seo.mjs';
import { pageSeo, seoHead } from './seo.mjs';
import { buildLocales, readCatalog } from './build-locales.mjs';
import { languages, localizedPath, renderFragments, interactionMessages, escapeHtml, messageKeys } from './localization.mjs';
import { buildCatalog } from './build-catalog.mjs';
import { buildResources } from './build-resources.mjs';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'static-site');
await buildCatalog();
await buildResources();
await buildSeo();
await buildLocales();
const read = async file => JSON.parse(await readFile(join(root, file), 'utf8'));
const site = await read('content/site.json');
const catalog = await read('content/catalog.json');
const routes = await read('content/routes.json');
const header = await readFile(join(root, 'content/header.html'), 'utf8');
const footer = await readFile(join(root, 'content/footer.html'), 'utf8');
const behavior = await readFile(join(root, 'public/site.js'), 'utf8');
const messages = messageKeys(behavior);
// The export is entirely generated. Remove obsolete English pages and runtime language packs too.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ['assets', 'site.css', 'replica.css', 'site.js', 'robots.txt']) await cp(join(root, 'public', file), join(out, file), { recursive: true });
if (site.url) await cp(join(root, 'public/sitemap.xml'), join(out, 'sitemap.xml'));
for (const language of languages) {
  const dictionary = await readCatalog(language);
  for (const [route, meta] of Object.entries(routes)) {
    const outputFile = join(out, localizedPath(route, language), 'index.html');
    const directory = dirname(outputFile);
    const local = absolute => relative(directory, join(out, absolute.slice(1))) || '.';
    const source = renderFragments(header, await readFile(join(root, 'content/pages', meta.file), 'utf8'), footer, route, language, dictionary, routes);
    const markup = source.replace(/\b(href|src|action)="(\/[^"?#]*)([^"]*)"/g, (_, attr, path, suffix) => {
      const page = path.endsWith('/');
      return `${attr}="${local(page ? path + 'index.html' : path)}${suffix}"`;
    });
    const seo = pageSeo(route, meta, catalog, site, routes, language, dictionary);
    const html = `<!DOCTYPE html>\n<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(seo.title)}</title><meta name="description" content="${escapeHtml(seo.description)}">${seoHead(seo)}<link rel="icon" type="image/png" href="${local('/assets/brand/nearfastener_flag_transparent.png')}"><link rel="stylesheet" href="${local('/site.css')}"><link rel="stylesheet" href="${local('/replica.css')}"><script defer src="${local('/site.js')}"></script></head><body><a class="skip-link" href="#main-content">${escapeHtml(dictionary['Skip to content'] || 'Skip to content')}</a><div class="site-shell" data-page-path="${route}">${markup}</div>${interactionMessages(dictionary, messages)}</body></html>\n`;
    await mkdir(directory, { recursive: true });
    await writeFile(outputFile, html);
  }
  await writeFile(join(out, language.toLowerCase(), '404.html'), `<!DOCTYPE html><html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404</title></head><body><h1>404</h1><a href="/${language.toLowerCase()}/">${escapeHtml(dictionary['Home'] || 'Home')}</a></body></html>`);
}
// Old page files provide browser redirects on the existing static host.
for (const route of Object.keys(routes)) {
  const file = join(out, route.slice(1), 'index.html');
  const target = relative(dirname(file), join(out, localizedPath(route, 'en'), 'index.html'));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${target}"><title>Redirect</title></head><body><a href="${target}">Continue</a><script>const q=new URLSearchParams(location.search);const codes=${JSON.stringify(languages)};const code=codes.find(c=>c.toLowerCase()===q.get('lang')?.toLowerCase())||'en';q.delete('lang');const paths=${JSON.stringify(Object.fromEntries(languages.map(code => [code, relative(dirname(file), join(out, localizedPath(route, code), 'index.html'))])))};location.replace(paths[code]+(q.size?'?'+q:'')+location.hash);</script></body></html>`);
}
await writeFile(join(out, '404.html'), '<!DOCTYPE html><meta charset="utf-8"><meta name="robots" content="noindex"><title>404</title><h1>404</h1>');
console.log(`Exported ${Object.keys(routes).length * languages.length} language pages to ${out}`);
