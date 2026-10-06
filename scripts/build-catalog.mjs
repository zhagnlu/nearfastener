import { readFile, writeFile, mkdir, access, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogPages, homepageCategories, footerCategories } from './catalog.mjs';
import { customManufacturing } from './custom-manufacturing.mjs';
import { rfqContext, productBreadcrumb } from './catalog-detail.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildCatalog() {
  const catalog = JSON.parse(await readFile(join(root, 'content/catalog.json'), 'utf8'));
  const routesFile = join(root, 'content/routes.json');
  const routes = JSON.parse(await readFile(routesFile, 'utf8'));
  const pages = catalogPages(catalog, routes);
  // Validate inputs before changing generated files.
  for (const item of [...catalog.categories, ...catalog.products].filter((item) => item.status === 'published')) {
    if (item.image) await access(join(root, 'public', item.image));
    if (item.path.startsWith('/product/') && !item.detail) await access(join(root, 'content/pages', routes[item.path].file));
  }
  for (const [path, meta] of Object.entries(routes)) {
    if (meta.catalogGenerated && !pages.has(path)) {
      delete routes[path];
      await unlink(join(root, 'content/pages', meta.file)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  for (const [path, { html, ...meta }] of pages) {
    const file = join(root, 'content/pages', meta.file);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
    routes[path] = meta;
  }
  // Captured product bodies stay editable; their navigation follows catalog data.
  for (const product of catalog.products.filter((item) => item.status === 'published' && !item.detail)) {
    const file = join(root, 'content/pages', routes[product.path].file);
    const html = await readFile(file, 'utf8');
    const updated = html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/, productBreadcrumb(catalog, product));
    if (updated !== html) await writeFile(file, updated);
  }
  const footerFile = join(root, 'content/footer.html');
  const footer = await readFile(footerFile, 'utf8');
  const footerProducts = /(<h4\b[^>]*>Products<\/h4><ul\b[^>]*>)[\s\S]*?(<\/ul>)/;
  if (!footerProducts.test(footer)) throw new Error('Missing footer product categories');
  await writeFile(footerFile, footer.replace(footerProducts, (_, open, close) => `${open}${footerCategories(catalog)}${close}`));
  const homeFile = join(root, 'content/pages/home.html');
  const home = await readFile(homeFile, 'utf8');
  const homeCategories = /<section\b[^>]*>(?:(?!<section\b)[\s\S])*?Product Categories[\s\S]*?<\/section>/;
  if (!homeCategories.test(home)) throw new Error('Missing homepage product categories section');
  const alignedHome = home.replace(homeCategories, homepageCategories(catalog));
  const customBlock = `<!-- custom-manufacturing:start -->${customManufacturing(catalog)}<!-- custom-manufacturing:end -->`;
  const customMarker = /<!-- custom-manufacturing:start -->[\s\S]*?<!-- custom-manufacturing:end -->/;
  await writeFile(homeFile, customMarker.test(alignedHome) ? alignedHome.replace(customMarker, customBlock) : alignedHome.replace('</section>', `</section>${customBlock}`));
  await writeFile(routesFile, JSON.stringify(routes, null, 2) + '\n');
  const rfqFile = join(root, 'content/pages/rfq.html');
  const rfq = await readFile(rfqFile, 'utf8');
  const marker = /<!-- catalog-rfq:start -->[\s\S]*?<!-- catalog-rfq:end -->/;
  if (!marker.test(rfq)) throw new Error('Missing catalog RFQ context marker');
  await writeFile(rfqFile, rfq.replace(marker, `<!-- catalog-rfq:start -->${rfqContext(catalog)}<!-- catalog-rfq:end -->`));
  console.log(`Built ${catalog.categories.filter((item) => item.status === 'published').length} catalog categories from ${catalog.products.filter((item) => item.status === 'published').length} unique products.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildCatalog();
