import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { technicalGuidance } from '../scripts/technical-guidance.mjs';
import { localizeHtml } from '../scripts/localization.mjs';
import catalog from '../content/catalog.json' with { type: 'json' };

test('SEMS and structural bolt pages answer product-specific purchasing questions in static HTML', async () => {
  const sems = await readFile(new URL('../content/pages/product/sems-screw.html', import.meta.url), 'utf8');
  assert.match(sems, /washer inside diameter, outside diameter, thickness/);
  assert.match(sems, /Check the installed envelope/);
  assert.doesNotMatch(sems, /pencom|technical-guidance-sources/i);
  const structural = await readFile(new URL('../content/pages/product/gb-t-32076-7-high-strength-bolt.html', import.meta.url), 'utf8');
  assert.match(structural, /GB\/T 32076.7-2015 covers M39–M64/);
  assert.match(structural, /https:\/\/openstd\.samr\.gov\.cn/);
  assert.match(structural, /Agree the installation requirements/);
});

test('technical guidance preserves localized content and rejects missing references', () => {
  const product = catalog.products.find(product => product.id === 'sems-screw');
  const html = technicalGuidance(product);
  assert.ok(!localizeHtml(html, 'zh-CN').includes('Check the installed envelope'));
  assert.throws(() => technicalGuidance({ technicalGuides: [{ article: 'missing', sections: [] }] }), /Unknown technical guide/);
  assert.throws(() => technicalGuidance({ technicalGuides: [{ article: 'sems-screw-selection', sections: ['missing'] }] }), /Unknown technical guide section/);
  const categories = catalog.categories.filter(category => category.status === 'published');
  assert.equal(new Set(categories.map(category => category.description)).size, categories.length);
});
