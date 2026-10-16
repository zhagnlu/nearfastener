import resources from '../content/resources.json' with { type: 'json' };
import { languages, localizedPath, translator } from './localization.mjs';
import { publicSources } from './resource-sources.mjs';

const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export function siteOrigin(site) {
  if (!site.url) return null;
  const url = new URL(site.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Site URL must be an HTTPS origin');
  return url.origin;
}
export function pageSeo(path, page, catalog, site, routes, language = 'en') {
  const origin = siteOrigin(site);
  const t = translator(language);
  const absolute = (value) => origin ? new URL(value, origin).href : undefined;
  const pageUrl = (value) => absolute(localizedPath(value, language));
  const canonical = pageUrl(path);
  const product = catalog.products.find(item => item.status === 'published' && item.path === path);
  const category = catalog.categories.find(item => item.status === 'published' && item.path === path);
  const article = resources.articles.find(item => `/resources/${item.id}` === path);
  let title = t(page.title);
  let description = t(page.description);
  if (product || category) {
    const item = product ?? category;
    title = `${t(item.title)} | ${t(product ? 'Specifications' : 'Product Families')} | ${site.name}`;
    description = `${t(item.title)}. ${category ? `${t('Product Families')}: ` : ''}${t(item.description)}`;
  } else if (path.startsWith('/standards/')) {
    title = `${t(page.title.replace(/ \| Near Fastener$/, ''))} | ${t('Standards')} | ${site.name}`;
    description = `${t(page.title.replace(/ \| Near Fastener$/, ''))}. ${description}`;
  }
  const image = absolute(product?.image ?? category?.image ?? article?.image ?? site.defaultImage);
  const orgId = absolute('/#organization');
  const websiteId = absolute('/#website');
  const organization = { '@type': 'Organization', '@id': orgId, name: site.name, email: site.email, telephone: site.telephone, foundingDate: site.foundingDate, address: site.address ? { '@type': 'PostalAddress', ...site.address } : undefined, url: absolute('/'), logo: absolute('/assets/brand/nearfastener_flag_transparent.png') };
  const type = path === '/about' ? 'AboutPage' : path === '/contact' ? 'ContactPage' : product ? 'ItemPage' : category || ['/products', '/resources', '/standards'].includes(path) ? 'CollectionPage' : 'WebPage';
  const webPage = { '@type': type, '@id': canonical ? `${canonical}#webpage` : undefined, name: title, description, url: canonical, inLanguage: language, isPartOf: websiteId ? { '@id': websiteId } : undefined, primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined };
  const graph = [organization, { '@type': 'WebSite', '@id': websiteId, name: site.name, url: absolute('/'), publisher: orgId ? { '@id': orgId } : organization, inLanguage: languages }, webPage];
  const crumbs = [{ name: t('Home'), path: '/' }];
  if (product || category) {
    crumbs.push({ name: t('Products'), path: '/products' });
    const ancestors = []; let current = product ? catalog.categories.find(item => item.id === product.primaryCategoryId) : catalog.categories.find(item => item.id === category.parentId);
    while (current) { ancestors.unshift({ name: t(current.title), path: current.path }); current = catalog.categories.find(item => item.id === current.parentId); }
    crumbs.push(...ancestors);
  } else if (path.startsWith('/standards/')) crumbs.push({ name: t('Standards'), path: '/standards' });
  else if (path.startsWith('/resources/')) crumbs.push({ name: t('Resources'), path: '/resources' });
  else if (path === '/capabilities/production-line') crumbs.push({ name: t('About Us'), path: '/about' });
  if (path !== '/') crumbs.push({ name: t(product?.title ?? category?.title ?? page.title.replace(/ \| Near Fastener$/, '')), path });
  if (origin && crumbs.length > 1) graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: pageUrl(item.path) })) });
  if (product) {
    const productId = canonical ? `${canonical}#product` : undefined;
    webPage.mainEntity = productId ? { '@id': productId } : undefined;
    graph.push({ '@type': 'Product', '@id': productId, name: t(product.title), description: t(product.description), url: canonical, image, category: t(catalog.categories.find(item => item.id === product.primaryCategoryId)?.title), manufacturer: orgId ? { '@id': orgId } : organization, ...(product.detail?.specifications ? { additionalProperty: product.detail.specifications.map(([name, value]) => ({ '@type': 'PropertyValue', name: t(name), value: t(value) })) } : {}) });
  }
  if (article) {
    const articleId = canonical ? `${canonical}#article` : undefined;
    const citations = publicSources(article).map(source => source.url);
    webPage.mainEntity = articleId ? { '@id': articleId } : undefined;
    graph.push({ '@type': 'BlogPosting', '@id': articleId, headline: t(article.title), description: t(article.summary), inLanguage: language, dateModified: article.updated, image, author: orgId ? { '@id': orgId } : organization, publisher: orgId ? { '@id': orgId } : organization, mainEntityOfPage: canonical, ...(citations.length ? { citation: citations } : {}), about: article.relatedProducts.map(id => { const item = catalog.products.find(product => product.id === id); return { '@type': 'Thing', name: t(item.title), url: pageUrl(item.path) }; }) });
  }
  if (origin && path === '/products') graph.push({ '@type': 'ItemList', itemListElement: catalog.categories.filter(item => item.status === 'published' && !item.parentId).map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: t(item.title), url: pageUrl(item.path) })) });
  const alternates = origin ? [...languages.map(code => ({ language: code, url: absolute(localizedPath(path, code)) })), { language: 'x-default', url: absolute(localizedPath(path)) }] : [];
  return { title, description, canonical, alternates, image, type: article ? 'article' : 'website', language, structuredData: { '@context': 'https://schema.org', '@graph': graph }, index: !!routes[path] };
}
export function seoHead(seo) {
  return `${seo.canonical ? `<link rel="canonical" href="${escape(seo.canonical)}"><meta property="og:url" content="${escape(seo.canonical)}">` : ''}${seo.alternates.map(item => `<link rel="alternate" hreflang="${escape(item.language)}" href="${escape(item.url)}">`).join('')}<meta property="og:type" content="${seo.type}"><meta property="og:locale" content="${({ en: 'en_US', 'zh-CN': 'zh_CN', es: 'es_ES', fr: 'fr_FR', de: 'de_DE', pt: 'pt_PT', ru: 'ru_RU', ar: 'ar_SA', ja: 'ja_JP' })[seo.language]}"><meta property="og:site_name" content="Near Fastener"><meta property="og:title" content="${escape(seo.title)}"><meta property="og:description" content="${escape(seo.description)}">${seo.image ? `<meta property="og:image" content="${escape(seo.image)}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(seo.title)}"><meta name="twitter:description" content="${escape(seo.description)}">${seo.image ? `<meta name="twitter:image" content="${escape(seo.image)}">` : ''}<script type="application/ld+json">${safeJson(seo.structuredData)}</script>`;
}
export function sitemapXml(routes, site) {
  const origin = siteOrigin(site);
  if (!origin) return null;
  const absolute = (path, language) => escape(new URL(localizedPath(path, language), origin).href);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${Object.keys(routes).sort().flatMap(path => languages.map(language => `<url><loc>${absolute(path, language)}</loc>${languages.map(code => `<xhtml:link rel="alternate" hreflang="${code}" href="${absolute(path, code)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${absolute(path, 'en')}"/></url>`)).join('')}</urlset>\n`;
}
export function robotsTxt(site) {
  const origin = siteOrigin(site);
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /__debug\nDisallow: /_vinext/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`;
}
