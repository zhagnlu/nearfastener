import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { parse } from 'parse5';
import { languages, localizedPath, localizeHtml, translator } from '../scripts/localization.mjs';
import routes from '../content/routes.json' with { type: 'json' };

const out = new URL('../static-site/', import.meta.url).pathname;
const walk = (node, result = []) => { result.push(node); for (const child of node.childNodes ?? []) walk(child, result); return result; };
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;

test('every exported language has static content, local assets, complete language links and form routes', async () => {
  const destinations = new Set();
  for (const language of languages) {
    for (const path of Object.keys(routes)) {
      const file = join(out, localizedPath(path, language), 'index.html');
      const html = await readFile(file, 'utf8');
      assert.match(html, new RegExp(`<html lang="${language}"`), file);
      assert.match(html, /data-static-language=/, file);
      for (const node of walk(parse(html))) {
        const destination = attr(node, node.tagName === 'form' ? 'action' : 'href');
        if (!attr(node, 'data-route') && !attr(node, 'data-language-code')) continue;
        const url = new URL(destination, `https://www.nearfastener.com${localizedPath(path, language)}`);
        assert.ok(url.pathname.endsWith('/'), `${file}: noncanonical navigation ${destination}`);
        assert.ok(!url.pathname.includes('index.html'), `${file}: index navigation ${destination}`);
        const offline = attr(node, node.tagName === 'form' ? 'data-offline-action' : 'data-offline-href');
        assert.ok(offline?.split(/[?#]/)[0].endsWith('index.html'), `${file}: missing offline fallback`);
      }
      for (const code of languages) assert.ok(html.includes(`data-language-code="${code}"`), `${file}: missing ${code} link`);
      assert.doesNotMatch(html, /AI-(generated|retouched)|LinkFoxAI/, file);
      for (const [, value] of html.matchAll(/(?:src|href|action)="([^"]+)"/g)) {
        if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(value)) continue;
        destinations.add(resolve(dirname(file), value.split(/[?#]/)[0]));
      }
      for (const [, image] of html.matchAll(/(<img\b[^>]*>)/g)) {
        assert.match(image, /\bwidth="\d+"/, file);
        assert.match(image, /\bheight="\d+"/, file);
        assert.match(image, /\balt="/, file);
      }
    }
    const html = await readFile(join(out, localizedPath('/about', language), 'index.html'), 'utf8');
    const nodes = walk(parse(html));
    assert.equal(text(nodes.find(node => node.tagName === 'h1')), translator(language)('About Us'));
    const schema = JSON.parse(text(nodes.find(node => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json')));
    assert.equal(schema['@graph'].find(node => node['@type'] === 'AboutPage').inLanguage, language);
    const rfq = await readFile(join(out, localizedPath('/product/sems-screw', language), 'index.html'), 'utf8');
    assert.match(rfq, new RegExp(`name="lang" value="${language}"`));
  }
  await Promise.all([...destinations].map(path => access(path)));
});

test('HTML localization preserves escaped text, technical attributes and non-translatable values', () => {
  const html = '<div><h1>About Us</h1><a href="/rfq?product_id=sems-screw&amp;quantity=10" title="Contact Us">Contact Us</a><input name="material" value="SS304/316"><script type="application/ld+json">{"name":"About Us"}</script><span data-no-translate>About Us</span></div>';
  const result = localizeHtml(html, 'zh-CN');
  assert.ok(result.includes('<h1>关于我们</h1>'));
  assert.ok(result.includes('href="/rfq?product_id=sems-screw&amp;quantity=10"'));
  assert.ok(result.includes('value="SS304/316"'));
  assert.ok(result.includes('{"name":"About Us"}'));
  assert.ok(result.includes('data-no-translate>About Us</span>') || result.includes('data-no-translate="">About Us</span>'));
});
