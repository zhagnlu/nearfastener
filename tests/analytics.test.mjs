import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { analyticsConfig, analyticsHead } from '../scripts/analytics.mjs';

const source = await readFile(new URL('../public/analytics.js', import.meta.url), 'utf8');
const site = { url: 'https://www.nearfastener.com', analytics: { measurementId: 'G-TEST123456' } };
function fixture({ host = 'www.nearfastener.com', id = 'G-TEST123456' } = {}) {
  const listeners = new Map(), scripts = [];
  const window = {};
  const location = new URL(`https://${host}/zh-CN/product/sems-screw/?email=private@example.com`);
  const document = {
    currentScript: { dataset: { measurementId: id, analyticsHost: 'www.nearfastener.com' } },
    documentElement: { lang: 'zh-CN' }, referrer: 'https://www.google.com/search?q=private',
    querySelector: selector => selector === '[data-page-path]' ? { dataset: { pagePath: '/product/sems-screw' } } : null,
    addEventListener: (name, callback) => listeners.set(name, callback),
    createElement: () => ({}), head: { append: script => scripts.push(script) },
  };
  vm.runInNewContext(source, { window, document, location, URL });
  return { window, listeners, scripts };
}

test('analytics stays disabled without a configured ID and rejects invalid configuration', () => {
  assert.equal(analyticsHead({ url: site.url }), '');
  assert.equal(analyticsConfig({ ...site, analytics: { measurementId: null } }), null);
  assert.throws(() => analyticsConfig({ ...site, analytics: { measurementId: 'bad-id' } }), /Invalid GA4/);
  assert.match(analyticsHead(site), /data-measurement-id="G-TEST123456"/);
  for (const options of [{ host: 'localhost' }, { id: '' }]) {
    const result = fixture(options);
    assert.equal(result.scripts.length, 0);
    assert.equal(result.window.NearFastenerAnalytics, undefined);
  }
});

test('analytics emits a single pageview and only allowed conversion signals without customer data', () => {
  const { window, listeners, scripts } = fixture();
  const commands = () => Array.from(window.dataLayer, args => Array.from(args));
  assert.equal(scripts.length, 1);
  assert.equal(commands().filter(args => args[0] === 'event' && args[1] === 'page_view').length, 1);
  window.NearFastenerAnalytics.track('rfq_submit');
  window.NearFastenerAnalytics.track('generate_lead');
  const events = commands().filter(args => args[0] === 'event');
  assert.equal(events.at(-1)[1], 'rfq_submit');
  assert.equal(events.at(-1)[2].submission_stage, 'provider_handoff');
  assert.equal(events.at(-1)[2].product_id, 'sems-screw');
  assert.ok(!JSON.stringify(commands()).includes('private'));
  const click = url => listeners.get('click')({ target: { closest: () => ({ href: url }) } });
  click('mailto:info@nearfastener.com?body=private');
  click('https://wa.me/8613813096295?text=private');
  click('https://www.nearfastener.com/zh-CN/rfq/?product_id=sems-screw');
  assert.deepEqual(commands().filter(args => args[0] === 'event').slice(-3).map(args => args[1]), ['email_click', 'whatsapp_click', 'rfq_click']);
  assert.ok(!JSON.stringify(commands()).includes('private'));
  listeners.get('submit')({ target: { matches: () => true, checkValidity: () => false } });
  assert.ok(!commands().some(args => args[1] === 'rfq_start'));
});
