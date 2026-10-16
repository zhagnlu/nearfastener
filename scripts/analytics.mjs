export function analyticsConfig(site) {
  const measurementId = site.analytics?.measurementId;
  if (measurementId == null || measurementId === '') return null;
  if (!/^G-[A-Z0-9]{6,20}$/.test(measurementId)) throw new Error('Invalid GA4 measurement ID');
  if (!site.url || new URL(site.url).protocol !== 'https:') throw new Error('Analytics requires a production HTTPS origin');
  return { measurementId, host: new URL(site.url).hostname };
}

export function analyticsHead(site, source = '/analytics.js') {
  const config = analyticsConfig(site);
  if (!config) return '';
  return `<script defer src="${source}" data-measurement-id="${config.measurementId}" data-analytics-host="${config.host}"></script>`;
}
