import resources from '../content/resources.json' with { type: 'json' };
const e = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function productSupport(catalog, product) {
  const related = catalog.products.filter((item) => item.status === 'published' && item.id !== product.id && item.primaryCategoryId === product.primaryCategoryId).slice(0, 3);
  const guides = [...resources.articles].reverse().filter((article) => article.relatedProducts.includes(product.id)).sort((a, b) => b.updated.localeCompare(a.updated));
  const generic = resources.articles.find((article) => article.id === 'custom-fastener-rfq-checklist');
  if (generic && !guides.includes(generic)) guides.push(generic);
  const copy = catalog.customManufacturing;
  return `<section class="product-buying-guide"><h2>Before You Order</h2><div class="product-buying-grid"><article><h3>${e(copy.cards[0].title)}</h3><p>${e(copy.cards[0].text)}</p></article><article><h3>${e(copy.cards[1].title)}</h3><p>${e(copy.cards[1].text)}</p></article></div><p class="product-buying-terms">${e(copy.terms)}</p></section>${related.length ? `<section class="product-recommendations"><h2>Related Products</h2><div class="product-recommendation-grid">${related.map((item) => `<a href="${e(item.path)}"><img src="${e(item.image)}" alt="${e(item.title)}" width="1200" height="800" loading="lazy"><div><h3>${e(item.title)}</h3><p>${e(item.description)}</p></div></a>`).join('')}</div></section>` : ''}${guides.length ? `<section class="product-guides"><h2>More guides</h2>${guides.slice(0, 3).map((article) => `<a href="/resources/${e(article.id)}"><h3>${e(article.title)}</h3><p>${e(article.summary)}</p></a>`).join('')}</section>` : ''}`;
}
