import { buildSeo } from './build-seo.mjs';
import { pageSeo, seoHead } from './seo.mjs';
import { buildLocales } from './build-locales.mjs';
import { buildCatalog } from './build-catalog.mjs';
import { buildResources } from './build-resources.mjs';
import { readFile, writeFile, mkdir, cp, unlink, rm } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'static-site');
await buildCatalog();
await buildResources();
await buildSeo();
const site = JSON.parse(await readFile(join(root, 'content/site.json'), 'utf8'));
const catalog = JSON.parse(await readFile(join(root, 'content/catalog.json'), 'utf8'));
const routes = JSON.parse(await readFile(join(root, 'content/routes.json'), 'utf8'));
const header = await readFile(join(root, 'content/header.html'), 'utf8');
const footer = await readFile(join(root, 'content/footer.html'), 'utf8');
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
await buildLocales();
await mkdir(out, { recursive: true });
const manifest = join(out, '.exported-routes.json');
const previousRoutes = JSON.parse(await readFile(manifest, 'utf8').catch((error) => { if (error.code === 'ENOENT') return '[]'; throw error; }));
for (const route of previousRoutes) {
  if (!routes[route] && /^\/[a-z0-9/-]+$/.test(route)) {
    await unlink(join(out, route.slice(1), 'index.html')).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}
// Regenerate the exported asset tree so moved/deleted source images do not linger.
await rm(join(out, 'assets'), { recursive: true, force: true });
for (const legacyLogo of ['nearfastener_flag_transparent.png', 'nearfastener_flag.jpg']) await rm(join(out, legacyLogo), { force: true });
for (const file of ['assets', 'site.css', 'replica.css', 'site.js', 'i18n.js', 'locales']) await cp(join(root, 'public', file), join(out, file), { recursive: true });

await cp(join(root, 'public/robots.txt'), join(out, 'robots.txt'));
if (site.url) await cp(join(root, 'public/sitemap.xml'), join(out, 'sitemap.xml'));
else await unlink(join(out, 'sitemap.xml')).catch((error) => { if (error.code !== 'ENOENT') throw error; });

for (const [route, meta] of Object.entries(routes)) {
  const outputFile = join(out, route === '/' ? '' : route.slice(1), 'index.html');
  const directory = dirname(outputFile);
  const local = (absolute) => relative(directory, join(out, absolute.slice(1))) || '.';
  const source = header + await readFile(join(root, 'content/pages', meta.file), 'utf8') + footer;
  // Real relative links also let the entire replica open from index.html offline.
  const markup = source.replace(/\b(href|src|action)="(\/[^"?#]*)([^\"]*)"/g, (match, attr, path, suffix) => {
    if ((attr === 'href' || attr === 'action') && routes[path]) return `data-route="${path}" ${attr}="${local(path === '/' ? '/index.html' : path + '/index.html')}${suffix}"`;
    return `${attr}="${local(path)}${suffix}"`;
  });
  const html = `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}">${seoHead(pageSeo(route, meta, catalog, site, routes))}<link rel="icon" type="image/png" href="${local('/assets/brand/nearfastener_flag_transparent.png')}"><link rel="stylesheet" href="${local('/site.css')}"><link rel="stylesheet" href="${local('/replica.css')}"><script defer src="${local('/i18n.js')}"></script><script defer src="${local('/site.js')}"></script></head><body><a class="skip-link" href="#main-content">Skip to content</a><div class="site-shell" data-page-path="${route}">${markup}</div></body></html>\n`;
  await mkdir(directory, { recursive: true });
  await writeFile(outputFile, html);
}
await writeFile(join(out, 'README.txt'), `Near Fastener website replica\n\n${Object.keys(routes).length} HTML pages. All images, icons, styles and scripts are local.\nOpen index.html directly, or upload this entire folder to a static web server.\nRFQ submissions require the same-origin Cloudflare Worker /api/rfq endpoint, private R2 storage and configured Resend credentials. Offline files and static-only hosting cannot submit RFQs. Contact forms open an email draft for the visitor to review and send from their mail app.\nCompany placeholders and source copy are preserved for later editing.\n`);
console.log(`Exported ${Object.keys(routes).length} pages to ${out}`);
await writeFile(manifest, JSON.stringify(Object.keys(routes)) + '\n');
