const test = require('node:test');
const assert = require('node:assert/strict');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');
const { base, lhr, stubLighthouse } = require('./helpers/lighthouse');

test('unavailable local browser leaves the HTML report usable with no invented scores', async (t) => {
  stubLighthouse(t, [{ status: 'not-checked', reason: 'BROWSER_UNAVAILABLE' }]);
  const transport = stubTransport(t, [{ html: good }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await scan(page, base, { lighthouse: true });
  assert.equal(await page.locator('#report').isVisible(), true);
  assert.equal(transport.calls.length, 2);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('เปิด Chromium ไม่ได้'));
  assert.equal(await page.locator('[data-score-value]').count(), 0);
  assert.ok(!(await page.locator('#agentic-status').textContent()).includes('1/2'));
  assert.deepEqual(errors, []);
});

test('a later partial score report uses placeholders only for unavailable categories and never copies previous numeric values', async (t) => {
  const partial = lhr();
  partial.categories.performance.score = null;
  delete partial.categories.accessibility;
  partial.categories['best-practices'].score = '1';
  partial.categories.seo.score = 0;
  stubLighthouse(t, [lhr(), partial]);
  stubTransport(t, [{ html: good }, { status: 404 }, { html: good }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await scan(page, base, { lighthouse: true });
  assert.deepEqual(await page.locator('[data-score-value]').allTextContents(), ['72', '91', '100', '0']);
  await scan(page, base, { lighthouse: true });
  assert.deepEqual(await page.locator('[data-score-value]').allTextContents(), ['--', '--', '--', '0']);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('บางส่วน'));
  assert.equal(await page.locator('#summary-pages').textContent(), '1');
  assert.deepEqual(errors, []);
});

test('runtime failure cannot display numeric categories returned alongside it or hide the current HTML findings', async (t) => {
  stubLighthouse(t, [lhr({ runtimeError: { code: 'FAILED_DOCUMENT_REQUEST', message: 'PRIVATE_ENGINE_FAILURE' } })]);
  stubTransport(t, [{ html: good.replace(/<title>.*?<\/title>/s, '') }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await scan(page, base, { lighthouse: true });
  assert.equal(await page.locator('[data-score-value]').count(), 0);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('LIGHTHOUSE_RUNTIME'));
  assert.ok(await page.locator('#issue-rows tr').count() > 0);
  assert.ok(!(await page.locator('body').textContent()).includes('PRIVATE_ENGINE_FAILURE'));
  assert.deepEqual(errors, []);
});
