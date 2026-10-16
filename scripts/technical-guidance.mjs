import resources from '../content/resources.json' with { type: 'json' };
import { publicSources } from './resource-sources.mjs';

const e = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function technicalGuidance(item) {
  return (item.technicalGuides ?? []).map(reference => {
    const article = resources.articles.find(article => article.id === reference.article);
    if (!article) throw new Error(`Unknown technical guide: ${reference.article}`);
    const selected = reference.sections.map(id => {
      const section = article.sections.find(section => section.id === id);
      if (!section) throw new Error(`Unknown technical guide section: ${reference.article}/${id}`);
      return section;
    });
    return `<section class="technical-guidance" data-technical-guide="${e(article.id)}"><h2>${e(article.title)}</h2>${selected.map(section => {
      const sources = publicSources(article, section.sources ?? []);
      return `<section><h3>${e(section.title)}</h3>${section.paragraphs.map(paragraph => `<p>${e(paragraph)}</p>`).join('')}${section.table ? `<div class="technical-guidance-table" tabindex="0" role="region" aria-label="${e(section.title)}"><table><caption>${e(section.title)}</caption><thead><tr>${section.table.headers.map(cell => `<th scope="col">${e(cell)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row => `<tr>${row.map((cell, index) => index ? `<td>${e(cell)}</td>` : `<th scope="row">${e(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}${sources.length ? `<p class="technical-guidance-sources"><span>Sources</span>: ${sources.map(source => `<a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.label)}</a>`).join(' · ')}</p>` : ''}</section>`;
    }).join('')}<a class="technical-guidance-more" href="/resources/${e(article.id)}">${e('Read article')}</a></section>`;
  }).join('');
}
