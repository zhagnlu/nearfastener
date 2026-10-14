import { productSupport } from './product-support.mjs';
const e = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const link = (item) => `<a href="${e(item.path)}">${e(item.title)}</a>`;
const breadcrumb = (items, title) => `<nav class="catalog-breadcrumb product-breadcrumb">${items.map((item) => `${link(item)}<span class="catalog-separator" aria-hidden="true"></span>`).join('')}<span>${e(title)}</span></nav>`;
const note = (item) => `<article class="product-note"><h2>${e(item.title)}</h2><p>${e(item.text)}</p></article>`;
const frame = (title, intro, crumbs, body) => `<main id="main-content" class="flex-1"><div class="pt-20"><section class="product-heading"><div class="max-w-max-content mx-auto px-4 lg:px-8">${breadcrumb(crumbs, title)}<h1>${e(title)}</h1><p>${e(intro)}</p></div></section><section class="product-body max-w-max-content mx-auto px-4 lg:px-8">${body}</section></div></main>\n`;
const input = (name, label, type = 'text') => `<label for="request-${name}"><span>${e(label)}</span><input id="request-${name}" name="${name}" type="${type}" maxlength="160" ${type === 'number' ? 'min="1" step="1"' : ''}></label>`;

export function productRequest(product) {
  return `<section class="product-request"><div><p class="product-eyebrow">Request a Quote</p><h2>Specify your requirement</h2><p>Your selections will be carried into the RFQ form.</p></div><form action="/rfq" method="get" data-product-request><input type="hidden" name="product_id" value="${e(product.id)}"><input type="hidden" name="lang" value="en" data-request-language><input type="hidden" name="length_unit" value="mm"><div class="product-request-fields">${input('diameter', 'Diameter')}${input('length', 'Length (mm)', 'number')}${input('material', 'Material')}${input('property_class', 'Property Class')}${input('surface_treatment', 'Surface Treatment')}${input('quantity', 'Quantity', 'number')}</div><button type="submit" class="product-button">Continue to RFQ</button></form></section>`;
}

export function productBreadcrumb(catalog, product) {
  const categories = new Map(catalog.categories.map((item) => [item.id, item]));
  const ancestors = [];
  let category = categories.get(product.primaryCategoryId);
  while (category) { ancestors.unshift(category); category = categories.get(category.parentId); }
  return breadcrumb([{ path: '/', title: 'Home' }, { path: '/products', title: 'Products' }, ...ancestors], product.title);
}

export function validateDetails(catalog) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const notes = (items) => Array.isArray(items) && items.length > 0 && items.every((item) => text(item.title) && text(item.text));
  const standards = new Set();
  const paths = new Set();
  check(catalog.standards === undefined || Array.isArray(catalog.standards), 'Invalid standards');
  for (const standard of catalog.standards ?? []) {
    check(text(standard.id) && !standards.has(standard.id), 'Duplicate or invalid standard ID');
    check(/^\/standards\/[a-z0-9-]+$/.test(standard.path) && !paths.has(standard.path), 'Duplicate or invalid standard path');
    check(text(standard.title) && text(standard.description) && notes(standard.notes), `Invalid standard content: ${standard.id}`);
    check(standard.notes.every((item) => text(item.id)) && new Set(standard.notes.map((item) => item.id)).size === standard.notes.length, `Invalid standard note IDs: ${standard.id}`);
    for (const url of [standard.sourceUrl, standard.additionalSourceUrl].filter(Boolean)) check(/^https:\/\//.test(url), `Invalid standard source: ${standard.id}`);
    check(text(standard.sourceUrl), `Missing standard source: ${standard.id}`);
    standards.add(standard.id); paths.add(standard.path);
  }
  for (const product of catalog.products) {
    if (product.standardId) check(standards.has(product.standardId), `Unknown standard: ${product.standardId}`);
    if (!product.detail) continue;
    if (product.detail.standardNoteId) check((catalog.standards ?? []).find((item) => item.id === product.standardId)?.notes.some((item) => item.id === product.detail.standardNoteId), `Unknown standard note: ${product.id}`);
    check(text(product.image) && text(product.standard), `Missing product illustration or standard: ${product.id}`);
    check(notes(product.detail.notes) && text(product.detail.availability), `Invalid product detail: ${product.id}`);
    check(Array.isArray(product.detail.specifications) && product.detail.specifications.length > 0 && product.detail.specifications.every((row) => Array.isArray(row) && row.length === 2 && row.every(text)), `Invalid specifications: ${product.id}`);
  }
}

export function detailPages(catalog) {
  const pages = new Map();
  const categories = new Map(catalog.categories.map((item) => [item.id, item]));
  const products = catalog.products.filter((item) => item.status === 'published');
  for (const product of products.filter((item) => item.detail)) {
    const detail = product.detail;
    const standard = (catalog.standards ?? []).find((item) => item.id === product.standardId);
    const technicalNote = standard?.notes.find((item) => item.id === detail.standardNoteId);
    const ancestors = [];
    let category = categories.get(product.primaryCategoryId);
    while (category) { ancestors.unshift(category); category = categories.get(category.parentId); }
    const memberships = product.categoryIds.map((id) => categories.get(id)).filter((item) => item.status === 'published');
    const rfq = `/rfq?product_id=${encodeURIComponent(product.id)}`;
    const caption = product.imageKind === 'generated' ? '' : 'Product illustration — not a dimensional drawing.';
    const body = `<div class="product-layout"><figure class="product-figure"><img src="${e(product.image)}" alt="${e(product.title)}" width="1200" height="800">${caption ? `<figcaption>${e(caption)}</figcaption>` : ''}</figure><div class="product-summary"><p class="product-eyebrow">${e(product.standard)}</p><h2>Specifications</h2><dl class="product-specs">${detail.specifications.map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p class="product-availability">${e(detail.availability)}</p><div class="product-actions"><a class="product-button" href="${e(rfq)}">Request a Quote</a>${standard ? `<a class="product-secondary" href="${e(standard.path)}">Read the standard guide</a>` : ''}</div></div></div><div class="product-classification"><h2>Browse by category</h2><div class="product-tags">${memberships.map(link).join('')}</div></div><div class="product-notes">${detail.notes.map(note).join('')}${technicalNote ? note(technicalNote) : ''}</div>${productSupport(catalog, product)}${productRequest(product)}`;
    pages.set(product.path, { title: `${product.title} | Near Fastener`, description: product.description, file: `${product.path.slice(1)}.html`, catalogGenerated: true, html: frame(product.title, product.description, [{ path: '/', title: 'Home' }, { path: '/products', title: 'Products' }, ...ancestors], body) });
  }
  for (const standard of catalog.standards ?? []) {
    const related = products.filter((item) => item.standardId === standard.id);
    if (!related.length) continue;
    const body = `<div class="product-notes">${standard.notes.map(note).join('')}</div><section class="standard-products"><h2>Related Products</h2><div class="product-tags">${related.map(link).join('')}</div></section><div class="product-sources"><h2>Technical references</h2><a href="${e(standard.sourceUrl)}" target="_blank" rel="noopener noreferrer">ISO standard reference</a>${standard.additionalSourceUrl ? `<a href="${e(standard.additionalSourceUrl)}" target="_blank" rel="noopener noreferrer">DIN reference and application notes</a>` : ''}</div>`;
    pages.set(standard.path, { title: `${standard.title} | Near Fastener`, description: standard.description, file: `${standard.path.slice(1)}.html`, catalogGenerated: true, html: frame(standard.title, standard.description, [{ path: '/', title: 'Home' }, { path: '/standards', title: 'Standards' }], body) });
  }
  return pages;
}

export function rfqContext(catalog) {
  return `<section class="rfq-product-context" data-rfq-context hidden><h2>Selected product</h2>${catalog.products.filter((item) => item.status === 'published').map((item) => `<a hidden data-rfq-product-id="${e(item.id)}" data-product-title="${e(item.title)}" data-product-standard="${e(item.standard ?? '')}" href="${e(item.path)}">${e(item.title)}</a>`).join('')}</section>`;
}
