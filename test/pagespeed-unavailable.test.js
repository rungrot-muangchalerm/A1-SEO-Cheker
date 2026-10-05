const test = require('node:test');
const assert = require('node:assert/strict');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');
const { base, lhr, jsonResponse, key } = require('./helpers/pagespeed');

test('unconfigured PageSpeed leaves the real HTML report usable and score fields empty, without provider requests or mock fractions', async (t) => {
  key(t, '');
  const transport = stubTransport(t, [{ html: good }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  assert.equal(await page.locator('#report').isVisible(), true);
  assert.equal(transport.calls.length, 2);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('ยังไม่ได้ตั้งค่า'));
  assert.equal(await page.locator('[data-score-value]').count(), 0);
  assert.ok(!(await page.locator('#agentic-status').textContent()).includes('1/2'));
  assert.deepEqual(errors, []);
});

test('a later partial score report uses placeholders only for unavailable categories and never copies previous numeric values', async (t) => {
  key(t);
  const partial = lhr();
  partial.categories.performance.score = null;
  delete partial.categories.accessibility;
  partial.categories['best-practices'].score = '1';
  partial.categories.seo.score = 0;
  stubTransport(t, [{ html: good }, { status: 404 }, jsonResponse(), { html: good }, { status: 404 }, jsonResponse(partial)]);
  const { page, errors } = await frontend(t);
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  assert.deepEqual(await page.locator('[data-score-value]').allTextContents(), ['72', '91', '100', '0']);
  await scan(page, base);
  assert.deepEqual(await page.locator('[data-score-value]').allTextContents(), ['--', '--', '--', '0']);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('บางหมวด'));
  assert.equal(await page.locator('#summary-pages').textContent(), '1');
  assert.deepEqual(errors, []);
});

test('runtime failure cannot display numeric categories returned alongside it or hide the current HTML findings', async (t) => {
  key(t);
  stubTransport(t, [{ html: good.replace(/<title>.*?<\/title>/s, '') }, { status: 404 },
    jsonResponse(lhr({ runtimeError: { code: 'FAILED_DOCUMENT_REQUEST', message: 'SERVER_ONLY_TEST_KEY' } }))]);
  const { page, errors } = await frontend(t);
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  assert.equal(await page.locator('[data-score-value]').count(), 0);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('PAGESPEED_RUNTIME'));
  assert.ok(await page.locator('#issue-rows tr').count() > 0);
  assert.ok(!(await page.locator('body').textContent()).includes('SERVER_ONLY_TEST_KEY'));
  assert.deepEqual(errors, []);
});
