const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report, good } = require('./helpers/frontend');

test('zero issues with unexamined surfaces remains partial and lists missing coverage', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/good');
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'partial');
  assert.equal(await page.locator('#report-result').getAttribute('data-result'), 'none');
  assert.equal(await page.locator('#not-checked-list li').count(), result.notChecked.length);
  assert.ok((await page.locator('#report-scope').textContent()).includes('URL \u0e40\u0e14\u0e35\u0e22\u0e27'));
  assert.ok((await page.locator('#report-time').textContent()).trim());
  assert.equal(await page.locator('#issue-empty-message').textContent(), '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e44\u0e14\u0e49');
  assert.equal(await page.locator('#reset-filters').isVisible(), false);
  assert.deepEqual(errors, []);
});

test('unavailable robots is visible as missing coverage, never a passing crawl check', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/good', good, { robots: {
    kind: 'robots', url: 'https://fixture.example/robots.txt', status: 'not-checked', reason: 'TIMEOUT'
  } });
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  await page.locator('#not-checked-section summary').click();
  assert.ok((await page.locator('#not-checked-list').textContent()).includes('TIMEOUT'));
  await page.locator('#pages-tab').click();
  assert.ok((await page.locator('#page-rows').textContent()).includes('\u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49'));
  assert.equal(await page.locator('#scan-spinner').isVisible(), false);
  assert.deepEqual(errors, []);
});

test('completed API coverage displays completion while failures hide and clear the report', async (t) => {
  const { page, errors } = await frontend(t);
  let success = true;
  const result = report('https://fixture.example/good');
  result.status = 'completed';
  result.notChecked = [];
  await page.route('**/api/audits', (route) => success ? route.fulfill({ json: result }) :
    route.fulfill({ status: 502, json: { status: 'failed', message: 'Upstream unavailable' } }));
  await scan(page, result.requestedUrl);
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'completed');
  assert.equal(await page.locator('#not-checked-section').isVisible(), false);
  success = false;
  await scan(page, 'https://failed.example/');
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
  assert.equal(await page.locator('#scan-spinner').isVisible(), false);
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#report-time').textContent(), '');
  assert.equal(await page.locator('#not-checked-list li').count(), 0);
  assert.deepEqual(errors, []);
});
