import { languages, localizedPath, translate } from './localization.mjs';
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export function siteOrigin(site) {
  if (!site.url) return null;
  const url = new URL(site.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Site URL must be an HTTPS origin');
  return url.origin;
}
export function pageSeo(path, page, catalog, site, routes, language, dictionary = {}) {
  const origin = siteOrigin(site);
  const absolute = (value) => origin ? new URL(language && routes[value] ? localizedPath(value, language) : value, origin).href : undefined;
  const product = catalog.products.find((item) => item.status === 'published' && item.path === path);
  const category = catalog.categories.find((item) => item.status === 'published' && item.path === path);
  const image = product?.image ?? category?.image ?? site.defaultImage;
  const graph = [{ '@type': 'Organization', name: site.name, email: site.email, url: absolute('/'), logo: absolute('/assets/brand/nearfastener_flag_transparent.png') }, { '@type': product ? 'ItemPage' : category || path === '/products' ? 'CollectionPage' : 'WebPage', name: page.title, description: page.description, url: absolute(path), inLanguage: 'en' }];
  const crumbs = [{ name: 'Home', path: '/' }];
  if (product || category) {
    crumbs.push({ name: 'Products', path: '/products' });
    const ancestors = []; let current = product ? catalog.categories.find((item) => item.id === product.primaryCategoryId) : catalog.categories.find((item) => item.id === category.parentId);
    while (current) { ancestors.unshift({ name: current.title, path: current.path }); current = catalog.categories.find((item) => item.id === current.parentId); }
    crumbs.push(...ancestors);
  } else if (path.startsWith('/standards/')) crumbs.push({ name: 'Standards', path: '/standards' });
  else if (path.startsWith('/resources/')) crumbs.push({ name: 'Resources', path: '/resources' });
  if (path !== '/') crumbs.push({ name: product?.title ?? category?.title ?? page.title.replace(/ \| Near Fastener$/, ''), path });
  if (origin && crumbs.length > 1) graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absolute(item.path) })) });
  if (product) graph.push({ '@type': 'Product', name: product.title, description: product.description, url: absolute(path), image: absolute(image), category: catalog.categories.find((item) => item.id === product.primaryCategoryId)?.title, manufacturer: { '@type': 'Organization', name: site.name }, ...(product.detail?.specifications ? { additionalProperty: product.detail.specifications.map(([name, value]) => ({ '@type': 'PropertyValue', name, value })) } : {}) });
  if (origin && path === '/products') graph.push({ '@type': 'ItemList', itemListElement: catalog.categories.filter((item) => item.status === 'published' && !item.parentId).map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title, url: absolute(item.path) })) });
  if (language) {
    const localize = (value, key = '') => typeof value === 'string' ? (key === 'inLanguage' ? language : ['name', 'description', 'category', 'value'].includes(key) ? translate(value, dictionary) : value) : Array.isArray(value) ? value.map(item => localize(item)) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item, key)])) : value;
    graph.splice(0, graph.length, ...localize(graph));
  }
  return { alternates: language && origin ? [...languages.map(code => ({ language: code, url: origin + localizedPath(path, code) })), { language: 'x-default', url: origin + localizedPath(path, 'en') }] : [], title: translate(page.title, dictionary), description: translate(page.description, dictionary), canonical: absolute(path), image: absolute(image), structuredData: { '@context': 'https://schema.org', '@graph': graph }, index: !!routes[path] };
}
export function seoHead(seo) {
  return `${(seo.alternates || []).map(item => `<link rel="alternate" hreflang="${item.language}" href="${escape(item.url)}">`).join('')}${seo.canonical ? `<link rel="canonical" href="${escape(seo.canonical)}"><meta property="og:url" content="${escape(seo.canonical)}">` : ''}<meta property="og:type" content="website"><meta property="og:title" content="${escape(seo.title)}"><meta property="og:description" content="${escape(seo.description)}">${seo.image ? `<meta property="og:image" content="${escape(seo.image)}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(seo.title)}"><meta name="twitter:description" content="${escape(seo.description)}">${seo.image ? `<meta name="twitter:image" content="${escape(seo.image)}">` : ''}<script type="application/ld+json">${safeJson(seo.structuredData)}</script>`;
}
export function sitemapXml(routes, site) {
  const origin = siteOrigin(site);
  if (!origin) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${Object.keys(routes).sort().flatMap(path => languages.map(code => `<url><loc>${escape(new URL(localizedPath(path, code), origin).href)}</loc>${languages.map(other => `<xhtml:link rel="alternate" hreflang="${other}" href="${escape(origin + localizedPath(path, other))}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${escape(origin + localizedPath(path, 'en'))}"/></url>`)).join('')}</urlset>\n`;
}
export function robotsTxt(site) {
  const origin = siteOrigin(site);
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /__debug\nDisallow: /_vinext/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`;
}
