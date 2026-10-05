const test = require('node:test');
const assert = require('node:assert/strict');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good, bad, report } = require('./helpers/frontend');
const { base, jsonResponse, key } = require('./helpers/pagespeed');

async function readDownload(page, selector) {
  const event = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await event;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { text: Buffer.concat(chunks).toString('utf8'), filename: download.suggestedFilename() };
}

test('manual JSON contains the entire actual API round, independent of issue filters, including HTML evidence and source scores', async (t) => {
  key(t);
  stubTransport(t, [{ html: bad }, { status: 404 }, jsonResponse()]);
  const { page, errors } = await frontend(t);
  assert.equal(await page.locator('#export-json-button').isDisabled(), true);
  const response = page.waitForResponse((response) => response.url().endsWith('/api/audits'));
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  const original = await (await response).json();
  await page.locator('#issue-search').fill('no-matching-issue');
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  assert.equal(await page.locator('#export-json-button').isDisabled(), false);
  const downloaded = await readDownload(page, '#export-json-button');
  const parsed = JSON.parse(downloaded.text);
  assert.equal(parsed.export.format, 'seo-checker-json');
  assert.equal(parsed.export.scope, 'entire-round');
  assert.ok(Number.isFinite(Date.parse(parsed.export.exportedAt)));
  delete parsed.export;
  assert.deepEqual(parsed, original);
  assert.equal(JSON.parse(downloaded.text).pages[0].html, bad);
  assert.equal(JSON.parse(downloaded.text).lighthouse.categories[0].displayScore, 72);
  assert.ok(JSON.parse(downloaded.text).notChecked.length > 0);
  assert.ok(!downloaded.text.includes('SERVER_ONLY_TEST_KEY'));
  assert.deepEqual(errors, []);
});

test('zero-issue rounds still export JSON; exported HTML is inert text and never produces markup or runs source code', async (t) => {
  const source = good.replace('</body>', '<script>globalThis.__jsonXss=true;</script></body>');
  const result = report(base, source);
  const { page, errors } = await frontend(t, { width: 390, height: 844 });
  await page.route('**/api/audits', route => route.fulfill({ json: result }));
  await scan(page, base);
  assert.equal(await page.locator('#export-json-button').isDisabled(), false);
  const downloaded = await readDownload(page, '#export-json-button');
  assert.equal(JSON.parse(downloaded.text).pages[0].html, source);
  assert.equal(await page.evaluate(() => globalThis.__jsonXss), undefined);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
});

test('CSV includes round times/schema/filters and filenames separate rounds even when a fixture reuses the same timestamp', async (t) => {
  const first = report('https://fixture.example/first', bad);
  const second = report('https://fixture.example/second', bad);
  second.completedAt = first.completedAt;
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', route => route.fulfill({ json: route.request().postDataJSON().url === first.requestedUrl ? first : second }));
  await scan(page, first.requestedUrl);
  await page.locator('#issue-search').fill('image-alt');
  const csv = await readDownload(page, '#export-button');
  for (const value of ['reportFormat', 'schemaVersion', 'reportStartedAt', 'reportCompletedAt', 'exportedAt', 'filterQuery',
    first.startedAt, first.completedAt, 'seo-checker-issues-csv', 'image-alt']) assert.ok(csv.text.includes('"' + value + '"'));
  const firstJson = await readDownload(page, '#export-json-button');
  await scan(page, second.requestedUrl);
  const secondJson = await readDownload(page, '#export-json-button');
  assert.notEqual(firstJson.filename, secondJson.filename);
  assert.match(firstJson.filename, /^seo-report-\d{4}-\d{2}-\d{2}T[\w-]+-round-\d+\.json$/);
  assert.match(csv.filename, /^seo-issues-\d{4}-\d{2}-\d{2}T[\w-]+-round-\d+\.csv$/);
  assert.ok(!csv.filename.includes('fixture.example'));
  assert.deepEqual(errors, []);
});

test('CSV/JSON create browser Blobs only on explicit clicks, make no export API request and revoke object URLs after use or pagehide', async (t) => {
  const { page, errors } = await frontend(t);
  let requests = 0;
  await page.route('**/api/audits', route => { ++requests; return route.fulfill({ json: report(base, bad) }); });
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    globalThis.blobs = []; globalThis.revoked = [];
    URL.createObjectURL = blob => { const url = create(blob); globalThis.blobs.push({ url, type: blob.type }); return url; };
    URL.revokeObjectURL = url => { globalThis.revoked.push(url); revoke(url); };
  });
  await scan(page, base);
  assert.equal(await page.evaluate(() => globalThis.blobs.length), 0);
  await readDownload(page, '#export-button');
  await readDownload(page, '#export-json-button');
  assert.deepEqual(await page.evaluate(() => globalThis.blobs.map(entry => entry.type)), ['text/csv;charset=utf-8', 'application/json;charset=utf-8']);
  await page.waitForFunction(() => globalThis.blobs.every(entry => globalThis.revoked.includes(entry.url)));
  await readDownload(page, '#export-json-button');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  assert.equal(await page.evaluate(() => globalThis.blobs.every(entry => globalThis.revoked.includes(entry.url))), true);
  assert.equal(requests, 1);
  assert.deepEqual(errors, []);
});
