import { readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { robotsTxt, sitemapXml } from './seo.mjs';
export async function buildSeo() {
  const routes = JSON.parse(await readFile(new URL('../content/routes.json', import.meta.url), 'utf8'));
  const site = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
  const xml = sitemapXml(routes, site);
  await writeFile(new URL('../public/robots.txt', import.meta.url), robotsTxt(site));
  if (xml) await writeFile(new URL('../public/sitemap.xml', import.meta.url), xml);
  else await unlink(new URL('../public/sitemap.xml', import.meta.url)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  console.log(xml ? `Built sitemap with ${Object.keys(routes).length} pages.` : 'SEO metadata ready; canonical URLs and sitemap await the production domain.');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildSeo();
