const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report, good, bad } = require('./helpers/frontend');

async function downloadText(page) {
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const stream = await (await downloaded).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

test('issue filters and CSV export use the same current report evidence and steps', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/bad', bad, { status: 404 });
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  let downloads = 0;
  page.on('download', () => downloads++);
  await scan(page, result.requestedUrl);
  assert.equal(downloads, 0);
  assert.equal(await page.locator('#export-button').isDisabled(), false);
  await page.locator('#severity-filter').selectOption('warning');
  await page.locator('#category-filter').selectOption('images');
  await page.locator('#issue-search').fill('IMAGE-ALT');
  assert.equal(await page.locator('#issue-rows tr').count(), 1);
  const csv = await downloadText(page);
  const issue = result.issues.find((item) => item.ruleId === 'image-alt');
  assert.ok(csv.startsWith('\ufeff"ruleId","ruleVersion","outcome"'));
  for (const value of [issue.found, issue.steps[0], JSON.stringify(issue.evidence)]) {
    assert.ok(csv.includes(value.replace(/"/g, '""')));
  }
  assert.ok(csv.includes('"image-alt"'));
  assert.equal(csv.includes('"http-status"'), false);
  await page.locator('#issue-search').fill('missing-from-this-report');
  assert.equal(await page.locator('#issue-rows tr').count(), 0);
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  await page.locator('#reset-filters').click();
  assert.equal(await page.locator('#issue-rows tr').count(), result.issues.length);
  assert.deepEqual(errors, []);
});

test('CSV quotes separators, quotes and line breaks and neutralizes spreadsheet formulas', async (t) => {
  const { page, errors } = await frontend(t);
  const title = '=HYPERLINK("https://untrusted.example", "label"),\nnext';
  const result = report('https://fixture.example/bad', bad);
  result.issues[0].title = title;
  result.issues[0].found = '\t@SUM(1+1)';
  result.issues[0].impact = '\uff1d1+1';
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  await page.locator('#issue-search').fill('HYPERLINK');
  const csv = await downloadText(page);
  assert.ok(csv.includes('"\'=' + title.slice(1).replace(/"/g, '""') + '"'));
  assert.ok(csv.includes('"\'\t@SUM(1+1)"'));
  assert.ok(csv.includes('"\'\uff1d1+1"'));
  assert.equal(await page.locator('#issue-rows .fw-medium').textContent(), title);
  assert.deepEqual(errors, []);
});

test('copy buttons copy the current evidence and advice and report clipboard failure honestly', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/bad', bad);
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: (text) => { globalThis.copied = text; return Promise.resolve(); }
    } });
  });
  await page.locator('[data-issue-id="image-alt"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  const issue = result.issues.find((item) => item.ruleId === 'image-alt');
  await page.locator('[data-copy-kind="evidence"]').click();
  await page.waitForFunction(() => document.getElementById('copy-status').textContent);
  assert.equal(await page.evaluate(() => globalThis.copied), JSON.stringify(issue.evidence, null, 2));
  await page.locator('[data-copy-kind="steps"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-copy-kind="steps"]').disabled);
  assert.equal(await page.evaluate(() => globalThis.copied), issue.steps.map((step, i) => `${i + 1}. ${step}`).join('\n'));
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('Denied')); });
  await page.locator('[data-copy-kind="evidence"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-copy-kind="evidence"]').disabled);
  assert.equal(await page.locator('#copy-status').textContent(), '\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08');
  assert.deepEqual(errors, []);
});

test('page result/search filters use actual page checks and expose incomplete pages', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/bad', bad);
  const other = report('https://fixture.example/other', good, { robots: { status: 'not-checked', reason: 'TIMEOUT' } });
  result.pages.push(other.pages[0]);
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  await page.locator('#pages-tab').click();
  await page.locator('#page-filter').selectOption('not-checked');
  assert.equal(await page.locator('#page-rows tr').count(), 1);
  assert.ok((await page.locator('#page-rows').textContent()).includes('/other'));
  await page.locator('#page-search').fill('/bad');
  assert.equal(await page.locator('#page-rows tr').count(), 0);
  await page.locator('#page-filter').selectOption('warning');
  assert.equal(await page.locator('#page-rows tr').count(), 1);
  assert.ok((await page.locator('#page-rows').textContent()).includes('/bad'));
  assert.deepEqual(errors, []);
});

test('legacy clipboard fallback copies evidence and removes its temporary input', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/bad', bad);
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  await page.locator('[data-issue-id="image-alt"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    document.execCommand = (command) => {
      globalThis.fallbackCopy = document.querySelector('#detail-content textarea').value;
      return command === 'copy';
    };
  });
  await page.locator('[data-copy-kind="evidence"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-copy-kind="evidence"]').disabled);
  assert.equal(await page.evaluate(() => globalThis.fallbackCopy), JSON.stringify(result.issues.find((issue) => issue.ruleId === 'image-alt').evidence, null, 2));
  assert.equal(await page.locator('#detail-content textarea').count(), 0);
  assert.deepEqual(errors, []);
});
