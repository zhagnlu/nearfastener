// Pure catalog validation and rendering, shared by the builder and tests.
import { detailPages, validateDetails } from './catalog-detail.mjs';
import { customManufacturing } from './custom-manufacturing.mjs';
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const published = (item) => item.status === 'published';

export function validateCatalog(catalog, routes) {
  requireValue(catalog.schemaVersion === 1, 'Unsupported catalog schemaVersion');
  for (const name of ['categories', 'products', 'attributes']) requireValue(Array.isArray(catalog[name]), `${name} must be an array`);
  const ids = new Set();
  const paths = new Set();
  for (const [kind, items, prefix] of [['category', catalog.categories, '/products/'], ['product', catalog.products, '/product/']]) {
    for (const item of items) {
      requireValue(typeof item.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `Invalid ${kind} id`);
      requireValue(!ids.has(`${kind}:${item.id}`), `Duplicate ${kind} id: ${item.id}`);
      ids.add(`${kind}:${item.id}`);
      requireValue(typeof item.path === 'string' && item.path.startsWith(prefix) && /^\/[a-z0-9/-]+$/.test(item.path) && !item.path.endsWith('/') && !item.path.includes('//'), `Invalid path: ${item.path}`);
      requireValue(!paths.has(item.path), `Duplicate path: ${item.path}`);
      paths.add(item.path);
      requireValue(['draft', 'published'].includes(item.status), `Invalid status: ${item.id}`);
      requireValue(nonempty(item.title), `Missing title: ${item.id}`);
      if (item.image != null) requireValue(/^\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|svg)$/.test(item.image), `Invalid image: ${item.id}`);
      if (published(item)) requireValue(nonempty(item.description), `Missing description: ${item.id}`);
      if (kind === 'category') {
        requireValue(nonempty(item.kind), `Missing category kind: ${item.id}`);
        requireValue(item.navigationGroup === undefined || ['family', 'head-style', 'drive-type', 'performance', 'application'].includes(item.navigationGroup), `Invalid navigation group: ${item.id}`);
        requireValue(Array.isArray(item.aliases) && item.aliases.every(nonempty), `Invalid aliases: ${item.id}`);
      } else if (published(item) && !item.detail) {
        requireValue(routes[item.path] && !routes[item.path].catalogGenerated, `Missing product detail route: ${item.path}`);
      }
    }
  }
  const categories = new Map(catalog.categories.map((item) => [item.id, item]));
  for (const category of catalog.categories) {
    const ancestors = new Set([category.id]);
    let current = category;
    while (current.parentId != null) {
      requireValue(categories.has(current.parentId), `Unknown parent: ${current.parentId}`);
      requireValue(!ancestors.has(current.parentId), `Category cycle: ${category.id}`);
      ancestors.add(current.parentId);
      current = categories.get(current.parentId);
      if (published(category)) requireValue(published(current), `Published category has draft parent: ${category.id}`);
    }
  }
  const attributes = new Map();
  for (const attribute of catalog.attributes) {
    requireValue(nonempty(attribute.id) && nonempty(attribute.title) && !attributes.has(attribute.id), `Invalid or duplicate attribute: ${attribute.id}`);
    requireValue(Array.isArray(attribute.values) && attribute.values.every(nonempty) && new Set(attribute.values).size === attribute.values.length, `Invalid values: ${attribute.id}`);
    attributes.set(attribute.id, new Set(attribute.values));
  }
  for (const product of catalog.products) {
    requireValue(Array.isArray(product.categoryIds) && product.categoryIds.length > 0, `Missing categories: ${product.id}`);
    requireValue(new Set(product.categoryIds).size === product.categoryIds.length, `Duplicate membership: ${product.id}`);
    requireValue(product.categoryIds.includes(product.primaryCategoryId), `Invalid primary category: ${product.id}`);
    for (const id of product.categoryIds) requireValue(categories.has(id), `Unknown category: ${id}`);
    if (published(product)) requireValue(published(categories.get(product.primaryCategoryId)), `Published product has draft primary category: ${product.id}`);
    requireValue(product.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes), `Invalid attributes: ${product.id}`);
    for (const [key, values] of Object.entries(product.attributes)) {
      requireValue(attributes.has(key), `Unknown attribute: ${key}`);
      requireValue(Array.isArray(values) && values.every((value) => attributes.get(key).has(value)), `Unknown attribute value: ${product.id}/${key}`);
    }
  }
  validateDetails(catalog);
}

// A product can appear in multiple categories, but once within any parent rollup.
export function productsForCategory(catalog, id) {
  const included = new Set([id]);
  let previousSize;
  do {
    previousSize = included.size;
    for (const category of catalog.categories) if (published(category) && included.has(category.parentId)) included.add(category.id);
  } while (included.size !== previousSize);
  const visible = new Set(catalog.categories.filter(published).map((category) => category.id));
  return catalog.products.filter((product) => published(product) && product.categoryIds.some((categoryId) => visible.has(categoryId) && included.has(categoryId)));
}

const card = (item) => `<a class="catalog-card group bg-white rounded-card overflow-hidden border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1" href="${escape(item.path)}">${item.image ? `<div class="aspect-[3/2] overflow-hidden"><img src="${escape(item.image)}" alt="${escape(item.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy"></div>` : ''}<div class="p-5"><h2 class="font-semibold text-foreground text-lg mb-2 group-hover:text-accent transition-colors">${escape(item.title)}</h2>${item.standard ? `<p class="text-xs font-mono text-teal mb-2">${escape(item.standard)}</p>` : ''}<p class="text-sm text-muted-foreground line-clamp-2">${escape(item.description)}</p></div></a>`;
const familyCards = (items) => {
  const groups = new Map();
  const result = [];
  for (const item of items) {
    if (!item.displayFamilyId) { result.push(item); continue; }
    let family = groups.get(item.displayFamilyId);
    if (!family) {
      family = { ...item, title: item.displayFamilyTitle, standard: null, description: 'Product families for industrial fastening. Material, dimensions and finish are confirmed against your requirements.', variants: [] };
      groups.set(item.displayFamilyId, family); result.push(family);
    }
    family.variants.push(item);
  }
  return result.map((item) => item.variants?.length > 1 ? item : item.variants?.[0] ?? item);
};
const familyCard = (item) => item.variants ? `<article class="catalog-standard-family">${card(item)}<div class="product-tags">${item.variants.map((variant) => `<a href="${escape(variant.path)}">${escape(variant.standard)}</a>`).join('')}</div></article>` : card(item);
const grid = (items) => `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${familyCards(items).map(familyCard).join('')}</div>`;
// Homepage and product directory share the same published top-level categories.
export function homepageCategories(catalog) {
  return `<section class="py-20 lg:py-24 bg-secondary"><div class="max-w-max-content mx-auto px-4 lg:px-8"><div class="text-center mb-12"><h2 class="text-3xl lg:text-4xl font-bold text-primary mb-3">Product Categories</h2><p class="text-muted-foreground max-w-xl mx-auto">Browse our full range of industrial fasteners by product type.</p></div>${grid(catalog.categories.filter((item) => published(item) && !item.parentId))}</div></section>`;
}
export function footerCategories(catalog) {
  return catalog.categories.filter((item) => published(item) && !item.parentId).map((item) => `<li><a class="text-sm text-gray-400 hover:text-white transition-colors" href="${escape(item.path)}">${escape(item.title)}</a></li>`).join('');
}
const empty = '<div class="text-center py-16"><p class="text-muted-foreground mb-4">Products in this category are being updated.</p><a class="text-accent hover:underline font-semibold" href="/rfq">Request a custom quote instead</a></div>';
const categorySection = (title, body) => `<section class="catalog-group"><h2 class="text-2xl font-bold text-foreground mb-6">${escape(title)}</h2>${body}</section>`;
const navigationGroups = [['family', 'Product Families'], ['head-style', 'Browse by Head Style'], ['drive-type', 'Browse by Drive Type'], ['performance', 'Browse by Strength'], ['application', 'Browse by Application']];

export function categoryFacts(catalog, products) {
  const rows = products.map(product => `<tr><th scope="row"><a href="${escape(product.path)}">${escape(product.title)}</a></th><td>${escape(product.standard ?? 'Drawing / specification')}</td><td>${product.detail?.specifications?.length ? product.detail.specifications.slice(0, 3).map(([name, value]) => `<div><span>${escape(name)}</span>: <span>${escape(value)}</span></div>`).join('') : escape(product.description)}</td></tr>`).join('');
  return `<section class="category-facts"><h2>At a glance</h2><table><thead><tr><th scope="col">Products</th><th scope="col">Standard</th><th scope="col">Specifications</th></tr></thead><tbody>${rows}</tbody></table><h2 class="mt-8">Before You Order</h2><dl class="buying-answers"><div><dt>How should I specify a fastener for quotation?</dt><dd>${escape(catalog.customManufacturing.cards[0].text)}</dd></div><div><dt>What must be confirmed before production?</dt><dd>${escape(catalog.customManufacturing.terms)}</dd></div></dl><div class="workshop-actions"><a href="/resources/custom-fastener-rfq-checklist">${escape('Custom Fastener RFQ Checklist for Factory Bulk Orders')}</a><a href="/rfq">Request a Quote</a></div></section>`;
}

export function catalogPages(catalog, routes) {
  validateCatalog(catalog, routes);
  const categories = catalog.categories.filter(published);
  const allCategories = new Map(catalog.categories.map((category) => [category.id, category]));
  const pages = new Map();
  const index = routes['/products'];
  requireValue(index, 'Missing /products route');
  const intro = 'Browse our full range of industrial fasteners by product type. Each product is available in multiple standards, materials, and sizes.';
  const cta = customManufacturing(catalog);
  pages.set('/products', { ...index, catalogGenerated: true, html: `<main id="main-content" class="flex-1"><div class="pt-20"><section class="bg-steel-dark py-16"><div class="max-w-max-content mx-auto px-4 lg:px-8"><h1 class="text-3xl lg:text-4xl font-bold text-white mb-3">Our Products</h1><p class="text-gray-400 max-w-2xl">${intro}</p></div></section><section class="py-16"><div class="max-w-max-content mx-auto px-4 lg:px-8">${grid(categories.filter((item) => !item.parentId))}</div></section>${cta}</div></main>\n` });
  for (const category of categories) {
    const ancestors = [];
    let parent = allCategories.get(category.parentId);
    while (parent) { ancestors.unshift(parent); parent = allCategories.get(parent.parentId); }
    const breadcrumbs = [{ path: '/', title: 'Home' }, { path: '/products', title: 'Products' }, ...ancestors].map((item) => `<a class="hover:text-white" href="${escape(item.path)}">${escape(item.title)}</a><span class="catalog-separator" aria-hidden="true"></span>`).join('');
    const children = categories.filter((item) => item.parentId === category.id);
    const products = productsForCategory(catalog, category.id);
    const childSections = navigationGroups.map(([group, title]) => {
      const items = children.filter((item) => (item.navigationGroup ?? 'family') === group);
      return items.length ? categorySection(title, grid(items)) : '';
    }).join('');
    const productSection = category.id === 'custom-fasteners' ? customManufacturing(catalog, true) : products.length ? (children.length ? categorySection('All Products', grid(products)) : grid(products)) + categoryFacts(catalog, products) : children.length ? '' : empty;
    const html = `<main id="main-content" class="flex-1"><div class="pt-20"><section class="bg-steel-dark py-12"><div class="max-w-max-content mx-auto px-4 lg:px-8"><nav class="catalog-breadcrumb flex items-center gap-2 text-sm text-gray-400 mb-4">${breadcrumbs}<span class="text-white">${escape(category.title)}</span></nav><h1 class="text-3xl lg:text-4xl font-bold text-white mb-2">${escape(category.title)}</h1><p class="text-gray-400 max-w-2xl">${escape(category.description)}</p></div></section><section class="py-16"><div class="catalog-sections max-w-max-content mx-auto px-4 lg:px-8">${childSections}${productSection}</div></section></div></main>\n`;
    pages.set(category.path, { title: `${category.title} | Near Fastener`, description: category.description, file: `${category.path.slice(1)}.html`, catalogGenerated: true, html });
  }
  for (const [path, page] of detailPages(catalog)) pages.set(path, page);
  return pages;
}
