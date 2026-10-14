const e = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const pathFor = (article) => `/resources/${article.id}`;
const date = (article) => `<span>Updated</span> <time datetime="${e(article.updated)}">${e(article.updated)}</time>`;
const crumbs = (current) => `<nav class="blog-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/resources">Resources</a>${current ? `<span aria-hidden="true">/</span><span>${e(current)}</span>` : ''}</nav>`;
const frame = (hero, body) => `<main id="main-content" class="flex-1"><div class="pt-20"><section class="blog-hero"><div class="max-w-max-content mx-auto px-4 lg:px-8">${hero}</div></section>${body}</div></main>\n`;

export function resourcePages(data, catalog) {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const validId = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const text = (value) => typeof value === 'string' && value.trim();
  check(Array.isArray(data.topics) && Array.isArray(data.articles) && data.articles.length, 'Missing resource content');
  const topics = new Map(data.topics.map((topic) => [topic.id, topic.title]));
  check(topics.size === data.topics.length && data.topics.every((topic) => validId(topic.id) && text(topic.title)), 'Invalid resource topics');
  const products = new Map(catalog.products.filter((item) => item.status === 'published').map((item) => [item.id, item]));
  const ids = new Set();
  for (const article of data.articles) {
    check(validId(article.id) && !ids.has(article.id), 'Invalid or duplicate article ID'); ids.add(article.id);
    check(topics.has(article.topic) && text(article.title) && text(article.summary), `Invalid article metadata: ${article.id}`);
    check(/^\/assets\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_-]+\.(jpg|png|webp|svg)$/.test(article.image), `Invalid article image: ${article.id}`);
    check(article.imageKind === undefined || article.imageKind === 'generated', 'Invalid article image kind');
    check(/^\d{4}-\d{2}-\d{2}$/.test(article.updated) && new Date(article.updated).toISOString().slice(0, 10) === article.updated, 'Invalid article date');
    check(Array.isArray(article.sources) && article.sources.length, 'Missing article sources');
    const sources = new Set();
    for (const source of article.sources) {
      check(validId(source.id) && !sources.has(source.id) && text(source.label) && /^https:\/\/[^\s]+$/.test(source.url), 'Invalid article source'); sources.add(source.id);
    }
    check(Array.isArray(article.relatedProducts) && article.relatedProducts.length && article.relatedProducts.every((id) => products.has(id)), 'Unknown related product');
    check(Array.isArray(article.sections) && article.sections.length, 'Missing article sections');
    const sections = new Set();
    for (const section of article.sections) {
      check(validId(section.id) && !sections.has(section.id) && text(section.title), 'Invalid article section'); sections.add(section.id);
      check(Array.isArray(section.paragraphs) && section.paragraphs.length && section.paragraphs.every(text), 'Missing article paragraphs');
      check((section.sources ?? []).every((id) => sources.has(id)), 'Unknown article source');
      if (section.table) check(section.table.headers?.every(text) && section.table.rows?.length && section.table.rows.every((row) => row.length === section.table.headers.length && row.every(text)), 'Invalid article table');
    }
  }
  const card = (article) => `<article class="blog-card" data-resource-card data-topic="${e(article.topic)}"><a href="${pathFor(article)}"><img src="${e(article.image)}" alt="${e(article.title)}" loading="lazy"><div class="blog-card-copy"><p class="blog-topic">${e(topics.get(article.topic))}</p><h2>${e(article.title)}</h2><p>${e(article.summary)}</p><div class="blog-card-bottom"><span class="blog-date">${date(article)}</span><span class="blog-read">Read article</span></div></div></a></article>`;
  const pages = new Map();
  const indexTitle = 'Fastener Blog & Guides';
  const indexDescription = 'Practical guides to fastener standards, strength classes, materials and coatings. Turn technical requirements into a clear purchasing specification.';
  const indexBody = `<section class="blog-index max-w-max-content mx-auto px-4 lg:px-8"><div class="blog-filters" data-resource-filters role="group" aria-label="Filter articles by topic" hidden><button type="button" data-resource-filter="all" aria-pressed="true">All articles</button>${data.topics.map((topic) => `<button type="button" data-resource-filter="${e(topic.id)}" aria-pressed="false">${e(topic.title)}</button>`).join('')}</div><div class="blog-grid">${[...data.articles].reverse().sort((a, b) => b.updated.localeCompare(a.updated)).map(card).join('')}</div><div class="blog-cta"><div><h2>Ready to specify your fasteners?</h2><p>Send your drawing and requirements to start a quotation.</p></div><a class="product-button" href="/rfq">Request a Quote</a></div></section>`;
  pages.set('/resources', { title: `${indexTitle} | Near Fastener`, description: indexDescription, file: 'resources.html', html: frame(`${crumbs()}<p class="blog-eyebrow">Technical Resources</p><h1>${indexTitle}</h1><p class="blog-intro">${indexDescription}</p><div class="blog-hero-links"><a href="/products">View Products</a><a href="/standards">Standards</a></div>`, indexBody) });
  for (const article of data.articles) {
    const sources = new Map(article.sources.map((item) => [item.id, item]));
    const sourceLink = (item) => `<a href="${e(item.url)}" target="_blank" rel="noopener noreferrer">${e(item.label)}</a>`;
    const sections = article.sections.map((section) => `<section id="${e(section.id)}"><h2>${e(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${e(paragraph)}</p>`).join('')}${section.table ? `<div class="blog-table" tabindex="0" role="region" aria-label="${e(section.title)}"><table><caption>${e(section.title)}</caption><thead><tr>${section.table.headers.map((cell) => `<th scope="col">${e(cell)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((cell, index) => index ? `<td>${e(cell)}</td>` : `<th scope="row">${e(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}${section.sources?.length ? `<div class="blog-source-note"><span>Sources</span>: ${section.sources.map((id) => sourceLink(sources.get(id))).join(' · ')}</div>` : ''}</section>`).join('');
    const body = `<div class="blog-layout max-w-max-content mx-auto px-4 lg:px-8"><aside class="blog-toc"><nav aria-label="On this page"><h2>On this page</h2>${article.sections.map((section) => `<a href="#${e(section.id)}">${e(section.title)}</a>`).join('')}<a href="#references">Technical references</a></nav></aside><article class="blog-body"><figure><img class="blog-cover" src="${e(article.image)}" alt="${e(article.title)}" width="1536" height="1024"></figure><div class="blog-takeaway"><h2>At a glance</h2><p>${e(article.summary)}</p></div>${sections}<section id="references" class="blog-references"><h2>Technical references</h2><ul>${article.sources.map((item) => `<li>${sourceLink(item)}</li>`).join('')}</ul></section><section class="blog-related"><h2>Related Products</h2><div class="product-tags">${article.relatedProducts.map((id) => { const item = products.get(id); return `<a href="${e(item.path)}">${e(item.title)}</a>`; }).join('')}</div></section><div class="blog-cta"><div><h2>Ready to specify your fasteners?</h2><p>Send your drawing and requirements to start a quotation.</p></div><a class="product-button" href="/rfq">Request a Quote</a></div><section class="blog-more"><h2>More guides</h2>${[...data.articles].reverse().filter((item) => item.id !== article.id).sort((a, b) => Number(b.topic === article.topic) - Number(a.topic === article.topic) || b.updated.localeCompare(a.updated)).slice(0, 3).map((item) => `<a href="${pathFor(item)}">${e(item.title)}</a>`).join('')}<a class="blog-back" href="/resources">Back to all articles</a></section></article></div>`;
    pages.set(pathFor(article), { title: `${article.title} | Near Fastener`, description: article.summary, file: `resources/${article.id}.html`, html: frame(`${crumbs(topics.get(article.topic))}<p class="blog-eyebrow">${e(topics.get(article.topic))}</p><h1>${e(article.title)}</h1><div class="blog-meta"><span>Near Fastener</span><span aria-hidden="true">·</span>${date(article)}</div>`, body) });
  }
  return pages;
}
