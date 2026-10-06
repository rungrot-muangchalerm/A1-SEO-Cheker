const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { frontend, scan, good } = require('./helpers/frontend');
const { stubTransport } = require('./helpers/transport');
const { base, stubLighthouse } = require('./helpers/lighthouse');

async function download(page, selector, binary = false) {
  const event = page.waitForEvent('download');
  await page.locator(selector).click();
  const stream = await (await event).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const data = Buffer.concat(chunks);
  return binary ? data : data.toString('utf8');
}

test('complete browser/API workflow crawls, analyzes, opens factual evidence, exports both formats and replaces the round', async t => {
  stubLighthouse(t);
  const root = '<title>Repeated title</title><meta name="description" content="Root"><link rel="canonical" href="/">' +
    '<h1>Catalog</h1><a href="/child">Child</a><a href="/missing">Missing</a>';
  const child = '<title>Repeated title</title><meta name="description" content="Child"><link rel="canonical" href="/child">' +
    '<meta name="robots" content="noindex"><h1>Child</h1>';
  const transport = stubTransport(t, [{ status: 404 }, { html: root },
    { html: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + base + 'child</loc></url><url><loc>' + base + 'missing</loc></url></urlset>',
      headers: { 'content-type': 'application/xml' } },
    { html: child }, { status: 404, html: '<title>Missing</title>' }, { html: good }, { status: 404 }]);
  const service = require('../app/service/audit.service');
  const original = service.create;
  let result;
  let progressCount = 0;
  t.mock.method(service, 'create', async (body, options) => {
    const outcome = await original(body, { ...options, onProgress: async progress => {
      progressCount++;
      await options.onProgress?.(progress);
    } });
    result = outcome.data;
    return outcome;
  });
  const { page, errors } = await frontend(t);
  await page.locator('#crawl-pages').check();
  const event = page.waitForResponse(response => response.url().endsWith('/api/audits'));
  await scan(page, base, { lighthouse: true });
  const response = await event;
  assert.equal(response.headers()['cache-control'], 'no-store');
  assert.equal(response.headers()['set-cookie'], undefined);
  assert.ok(response.headers()['content-type'].startsWith('application/x-ndjson'));
  assert.ok(progressCount >= 3);
  assert.equal(result.scope.type, 'same-origin-crawl');
  assert.equal(result.pages.length, 3);
  assert.equal(transport.calls.length, 5);
  assert.ok(result.issues.some(issue => issue.ruleId === 'duplicate-title'));
  const broken = result.issues.find(issue => issue.ruleId === 'internal-link-target');
  assert.equal(broken.details.httpStatus, 404);
  assert.equal(broken.details.target, base + 'missing');
  assert.deepEqual(broken.urls, [base]);
  for (const field of ['pages', 'critical', 'warning', 'review']) {
    assert.equal(await page.locator('#summary-' + field).textContent(), String(result.summary[field]));
  }
  await page.locator('[data-issue-id="' + broken.id + '"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  const text = await page.locator('#detail-content').textContent();
  assert.ok(text.includes(base + 'missing') && text.includes('404'));
  assert.ok(text.includes(broken.steps[0]));
  assert.equal(await page.locator('#detail-content a[href="' + base + 'missing"]').count(), 0);
  await page.locator('#issue-drawer [data-bs-dismiss="offcanvas"]').click();
  await page.locator('#issue-drawer.show').waitFor({ state: 'hidden' });
  await page.locator('#issue-search').fill('internal-link-target');
  const filtered = JSON.parse(await download(page, '#export-button'));
  assert.ok(filtered.issues.some(issue => issue.ruleId === 'internal-link-target' && issue.found === broken.found));
  assert.ok(filtered.issues.every(issue => issue.ruleId !== 'duplicate-title'));
  const json = JSON.parse(await download(page, '#export-json-button'));
  delete json.export;
  assert.deepEqual(json, result);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await download(page, '#export-xlsx-button', true));
  assert.equal(workbook.getWorksheet('Pages').rowCount, result.pages.length + 1);
  assert.equal(workbook.getWorksheet('Issues').rowCount, result.issues.length + 1);
  assert.equal(workbook.getWorksheet('Scores').rowCount, result.lighthouse.categories.length + 1);
  for (const [index, category] of result.lighthouse.categories.entries()) {
    const row = workbook.getWorksheet('Scores').getRow(index + 2);
    assert.equal(row.getCell(1).value, category.id);
    assert.equal(row.getCell(3).value, category.score);
    assert.equal(row.getCell(4).value, category.displayScore);
    assert.equal(row.getCell(7).value, result.lighthouse.provider);
  }
  assert.deepEqual(JSON.parse(workbook.getWorksheet('Evidence').getCell('G2').value), result.issues[0].evidence[0]);
  await page.locator('#pages-tab').click();
  assert.equal(await page.locator('#page-rows tr').count(), 3);
  await page.locator('[data-page-url="' + base + 'child"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  assert.equal((await page.locator('#detail-content details code').allTextContents())[1], child);
  await page.locator('#issue-drawer [data-bs-dismiss="offcanvas"]').click();
  await page.locator('#issue-drawer.show').waitFor({ state: 'hidden' });
  await page.locator('#crawl-pages').uncheck();
  await scan(page, base + 'fresh');
  assert.equal(transport.calls.length, 7);
  assert.equal(await page.locator('#summary-pages').textContent(), '1');
  assert.equal(await page.locator('#issue-search').inputValue(), '');
  assert.equal(await page.locator('#detail-content').textContent(), '');
  const next = JSON.parse(await download(page, '#export-json-button'));
  assert.equal(next.requestedUrl, base + 'fresh');
  assert.equal(next.pages.length, 1);
  assert.equal(next.pages[0].html, good);
  assert.equal(next.lighthouse.reason, 'not-requested');
  assert.deepEqual(next.lighthouse.categories, []);
  await page.reload();
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#export-json-button').isDisabled(), true);
  assert.deepEqual(errors, []);
});
