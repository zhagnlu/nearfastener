(() => {
  const script = document.currentScript;
  const measurementId = script?.dataset.measurementId;
  if (!/^G-[A-Z0-9]{6,20}$/.test(measurementId || '') || location.protocol !== 'https:' || location.hostname !== script.dataset.analyticsHost || window.NearFastenerAnalytics) return;

  const cleanUrl = value => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.origin + url.pathname : '';
    } catch { return ''; }
  };
  const pageLocation = cleanUrl(location.href);
  const pageReferrer = cleanUrl(document.referrer);
  window.dataLayer = window.dataLayer || [];
  const gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('set', { page_location: pageLocation, page_referrer: pageReferrer });
  gtag('config', measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  gtag('event', 'page_view', { page_location: pageLocation, page_referrer: pageReferrer });

  const allowed = new Set(['rfq_click', 'rfq_start', 'rfq_submit', 'email_click', 'whatsapp_click']);
  const track = name => {
    if (!allowed.has(name)) return;
    const route = document.querySelector('[data-page-path]')?.dataset.pagePath;
    const product = route?.startsWith('/product/') ? route.slice('/product/'.length) : document.querySelector('[data-rfq-product-id]:not([hidden])')?.dataset.rfqProductId;
    const params = { page_location: pageLocation, language: document.documentElement.lang || 'en' };
    if (product && /^[a-z0-9-]{1,80}$/.test(product)) params.product_id = product;
    if (name === 'rfq_submit') params.submission_stage = 'provider_handoff';
    gtag('event', name, params);
  };
  window.NearFastenerAnalytics = { track };
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    const destination = new URL(anchor.href, location.href);
    if (destination.protocol === 'mailto:') track('email_click');
    else if (destination.protocol === 'https:' && ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(destination.hostname)) track('whatsapp_click');
    else if (destination.origin === location.origin && /\/rfq\/?$/.test(destination.pathname)) track('rfq_click');
  });
  document.addEventListener('submit', event => {
    if (event.target.matches('form[data-product-request]') && event.target.checkValidity()) track('rfq_start');
  }, true);
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(tag);
})();
