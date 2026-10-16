export function publicSources(article, ids) {
  const sources = ids === undefined ? article.sources : ids.map(id => {
    const source = article.sources.find(source => source.id === id);
    if (!source) throw new Error(`Unknown technical source: ${id}`);
    return source;
  });
  return sources.filter(source => source.public !== false);
}
