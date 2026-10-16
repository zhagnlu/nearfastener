import { buildSeo } from './build-seo.mjs';
import { pageSeo, seoHead } from './seo.mjs';
import { languages, languageNavigation, localizedPath, localizeHtml, resolveLocalizedPath, translator } from './localization.mjs';
import { buildLocales } from './build-locales.mjs';
import { buildCatalog } from './build-catalog.mjs';
import { buildResources } from './build-resources.mjs';
import { readFile, writeFile, mkdir, cp, unlink, rm } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { analyticsHead } from './analytics.mjs';

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
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
await buildLocales();
await mkdir(out, { recursive: true });
const manifest = join(out, '.exported-routes.json');
const previousRoutes = JSON.parse(await readFile(manifest, 'utf8').catch(error => { if (error.code === 'ENOENT') return '[]'; throw error; }));
const exportedRoutes = Object.keys(routes).flatMap(path => languages.map(language => localizedPath(path, language)));
const currentRoutes = new Set(exportedRoutes);
for (const route of previousRoutes) {
  if (!currentRoutes.has(route) && !currentRoutes.has(route + '/') && /^\/[a-zA-Z0-9/-]*$/.test(route)) {
    await unlink(join(out, route.slice(1), 'index.html')).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
await rm(join(out, 'assets'), { recursive: true, force: true });
for (const legacyLogo of ['nearfastener_flag_transparent.png', 'nearfastener_flag.jpg']) await rm(join(out, legacyLogo), { force: true });
for (const file of ['assets', 'site.css', 'replica.css', 'site.js', 'i18n.js', 'analytics.js', 'locales']) await cp(join(root, 'public', file), join(out, file), { recursive: true });
await cp(join(root, 'public/robots.txt'), join(out, 'robots.txt'));
if (site.url) await cp(join(root, 'public/sitemap.xml'), join(out, 'sitemap.xml'));
else await unlink(join(out, 'sitemap.xml')).catch(error => { if (error.code !== 'ENOENT') throw error; });
const dimensions = new Map();
const set = (node, name, value) => { const attr = node.attrs.find(attr => attr.name === name); if (attr) attr.value = value; else node.attrs.push({ name, value }); };
for (const [route, meta] of Object.entries(routes)) {
  const body = await readFile(join(root, 'content/pages', meta.file), 'utf8');
  const source = header + body + footer;
  for (const [, path] of source.matchAll(/<img\b[^>]*\bsrc="(\/assets\/[^"?#]+)"/g)) {
    if (!dimensions.has(path)) {
      const { width, height } = await sharp(join(root, 'public', path)).metadata();
      dimensions.set(path, { width, height });
    }
  }
  for (const language of languages) {
    const pagePath = localizedPath(route, language);
    const outputFile = join(out, pagePath, 'index.html');
    const directory = dirname(outputFile);
    const local = absolute => relative(directory, join(out, absolute.slice(1))) || '.';
    const withLanguages = source.replace('</footer>', languageNavigation(route, language) + '</footer>');
    const markup = localizeHtml(withLanguages, language, node => {
      const attrs = node.attrs;
      if (node.tagName === 'img') {
        const image = dimensions.get(attrs.find(attr => attr.name === 'src')?.value);
        if (image) for (const key of ['width', 'height']) if (!attrs.some(attr => attr.name === key)) set(node, key, String(image[key]));
      }
      if (node.tagName === 'input' && attrs.some(attr => attr.name === 'data-request-language')) set(node, 'value', language);
      const targetLanguage = attrs.find(attr => attr.name === 'data-language-code')?.value;
      const sourceSet = attrs.find(attr => attr.name === 'srcset');
      if (sourceSet) sourceSet.value = sourceSet.value.split(',').map(candidate => {
        const [source, descriptor] = candidate.trim().split(/\s+/);
        return `${source.startsWith('/') ? local(source) : source}${descriptor ? ` ${descriptor}` : ''}`;
      }).join(', ');
      for (const attr of attrs.filter(attr => ['href', 'src', 'action'].includes(attr.name) && /^\/(?!\/)/.test(attr.value))) {
        const url = new URL(attr.value, 'https://local.invalid');
        const resolved = resolveLocalizedPath(url.pathname);
        if ((attr.name === 'href' || attr.name === 'action') && routes[resolved.path]) {
          if (!targetLanguage) set(node, 'data-route', resolved.path);
          const destination = localizedPath(resolved.path, targetLanguage ?? language);
          set(node, `data-offline-${attr.name}`, `${local(destination + 'index.html')}${url.search}${url.hash}`);
          attr.value = `${local(destination).replace(/\/$/, '')}/${url.search}${url.hash}`;
        } else attr.value = `${local(url.pathname)}${url.search}${url.hash}`;
      }
    });
    const seo = pageSeo(route, meta, catalog, site, routes, language);
    const html = `<!DOCTYPE html>\n<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}" data-static-language="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(seo.title)}</title><meta name="description" content="${escape(seo.description)}">${seoHead(seo)}<link rel="icon" type="image/png" href="${local('/assets/brand/nearfastener_flag_transparent.png')}"><link rel="stylesheet" href="${local('/site.css')}"><link rel="stylesheet" href="${local('/replica.css')}">${analyticsHead(site, local('/analytics.js'))}<script defer src="${local('/i18n.js')}"></script><script defer src="${local('/site.js')}"></script></head><body><a class="skip-link" href="#main-content">${escape(translator(language)('Skip to content'))}</a><div class="site-shell" data-page-path="${route}">${markup}</div></body></html>\n`;
    await mkdir(directory, { recursive: true });
    await writeFile(outputFile, html);
  }
}
await writeFile(join(out, 'README.txt'), `Near Fastener website\n\n${exportedRoutes.length} localized HTML pages. All images, icons, styles and scripts are local.\nOpen index.html directly, or upload this entire folder to a static web server.\nRFQ submissions use FormSubmit email delivery to info@nearfastener.com, including attachments up to 10 MB. Online hosting and first-use email activation are required.\n`);
console.log(`Exported ${Object.keys(routes).length} pages in ${languages.length} languages (${exportedRoutes.length} HTML files) to ${out}`);
await writeFile(manifest, JSON.stringify(exportedRoutes) + '\n');
