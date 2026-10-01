import { readFile, writeFile, access, mkdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resourcePages } from './resources.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildResources() {
  const data = JSON.parse(await readFile(join(root, 'content/resources.json'), 'utf8'));
  const catalog = JSON.parse(await readFile(join(root, 'content/catalog.json'), 'utf8'));
  const routesFile = join(root, 'content/routes.json');
  const routes = JSON.parse(await readFile(routesFile, 'utf8'));
  const pages = resourcePages(data, catalog);
  for (const article of data.articles) await access(join(root, 'public', article.image));
  for (const [path, meta] of Object.entries(routes)) {
    if (meta.resourcesGenerated && !pages.has(path)) {
      delete routes[path];
      await unlink(join(root, 'content/pages', meta.file)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  for (const [path, { html, ...meta }] of pages) {
    await mkdir(dirname(join(root, 'content/pages', meta.file)), { recursive: true });
    await writeFile(join(root, 'content/pages', meta.file), html);
    routes[path] = { ...meta, resourcesGenerated: true };
  }
  await writeFile(routesFile, JSON.stringify(routes, null, 2) + '\n');
  console.log(`Built resource index and ${data.articles.length} complete guides.`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildResources();
