const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good, bad, report, clickExport } = require('./helpers/frontend');
const { base, stubLighthouse } = require('./helpers/lighthouse');

async function readDownload(page, selector) {
  const event = page.waitForEvent('download');
  await clickExport(page, selector);
  const download = await event;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { text: Buffer.concat(chunks).toString('utf8'), filename: download.suggestedFilename() };
}

test('manual JSON contains the entire actual API round, independent of issue filters, including HTML evidence and source scores', async (t) => {
  stubLighthouse(t);
  stubTransport(t, [{ html: bad }, { status: 404 }]);
  const service = require('../../app/service/audit.service');
  const create = service.create;
  let original;
  t.mock.method(service, 'create', async (body, options) => {
    const outcome = await create(body, options);
    original = outcome.data;
    return outcome;
  });
  const { page, errors } = await frontend(t);
  assert.equal(await page.locator('#export-json-button').isDisabled(), true);
  const response = page.waitForResponse((response) => response.url().endsWith('/api/audits'));
  await scan(page, base, { lighthouse: true });
  assert.match((await response).headers()['content-type'], /^application\/x-ndjson/);
  assert.ok(original);
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

test('filtered JSON includes round times/schema/filters and filenames separate rounds even when a fixture reuses the same timestamp', async (t) => {
  const first = report('https://fixture.example/first', bad);
  const second = report('https://fixture.example/second', bad);
  second.completedAt = first.completedAt;
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', route => route.fulfill({ json: route.request().postDataJSON().url === first.requestedUrl ? first : second }));
  await scan(page, first.requestedUrl);
  await page.locator('#issue-search').fill('image-alt');
  const issuesJson = await readDownload(page, '#export-button');
  const exported = JSON.parse(issuesJson.text);
  assert.equal(exported.schemaVersion, first.schemaVersion);
  assert.equal(exported.startedAt, first.startedAt);
  assert.equal(exported.completedAt, first.completedAt);
  assert.equal(exported.export.format, 'seo-checker-json');
  assert.equal(exported.export.scope, 'filtered-issues');
  assert.equal(exported.export.filters.query, 'image-alt');
  assert.ok(Number.isFinite(Date.parse(exported.export.exportedAt)));
  const firstJson = await readDownload(page, '#export-json-button');
  await scan(page, second.requestedUrl);
  const secondJson = await readDownload(page, '#export-json-button');
  assert.notEqual(firstJson.filename, secondJson.filename);
  assert.match(firstJson.filename, /^seo-report-\d{4}-\d{2}-\d{2}T[\w-]+-round-\d+\.json$/);
  assert.match(issuesJson.filename, /^seo-issues-\d{4}-\d{2}-\d{2}T[\w-]+-round-\d+\.json$/);
  assert.ok(!issuesJson.filename.includes('fixture.example'));
  assert.deepEqual(errors, []);
});

test('both JSON scopes create browser Blobs only on explicit clicks, make no export API request and revoke object URLs after use or pagehide', async (t) => {
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
  assert.deepEqual(await page.evaluate(() => globalThis.blobs.map(entry => entry.type)), ['application/json;charset=utf-8', 'application/json;charset=utf-8']);
  await page.waitForFunction(() => globalThis.blobs.every(entry => globalThis.revoked.includes(entry.url)));
  await readDownload(page, '#export-json-button');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  assert.equal(await page.evaluate(() => globalThis.blobs.every(entry => globalThis.revoked.includes(entry.url))), true);
  assert.equal(requests, 1);
  assert.deepEqual(errors, []);
});

test('all JSON/XLSX downloads stay disabled before/during/after failed audits, and successful rounds never download automatically', async (t) => {
  stubTransport(t, [{ html: bad, delay: 500 }, { status: 404 }, { networkError: true }]);
  const { page, errors } = await frontend(t);
  let downloads = 0;
  page.on('download', () => ++downloads);
  const ids = ['export-menu-button', 'export-button', 'export-json-button', 'export-xlsx-button', 'export-issues-xlsx-button'];
  for (const id of ids) assert.equal(await page.locator('#' + id).isDisabled(), true);
  await page.locator('#website-url').fill(base);
  await page.locator('#scan-button').click();
  await page.waitForFunction(() => document.getElementById('report').getAttribute('aria-busy') === 'true');
  for (const id of ids) {
    assert.equal(await page.locator('#' + id).isDisabled(), true);
    await page.locator('#' + id).evaluate(element => element.click());
  }
  await page.waitForFunction(() => document.getElementById('report').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator('#export-json-button').isDisabled(), false);
  assert.equal(downloads, 0);
  await scan(page, base);
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
  for (const id of ids) assert.equal(await page.locator('#' + id).isDisabled(), true);
  assert.equal(downloads, 0);
  await page.reload();
  assert.equal(await page.locator('#export-json-button').isDisabled(), true);
  assert.deepEqual(errors, []);
});

test('new audit replaces export contents and F5 clears the report while an explicitly saved fixture JSON remains readable on disk', async (t) => {
  const first = report(base + 'first', bad), second = report(base + 'second', good);
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', route => route.fulfill({ json: route.request().postDataJSON().url === first.requestedUrl ? first : second }));
  await scan(page, first.requestedUrl);
  const event = page.waitForEvent('download');
  await clickExport(page, '#export-json-button');
  const downloaded = await event;
  const destination = path.join(os.tmpdir(), 'seo-checker-saved-fixture-' + randomUUID() + '.json');
  await downloaded.saveAs(destination);
  t.after(() => fs.unlink(destination));
  const saved = await fs.readFile(destination, 'utf8');
  assert.equal(JSON.parse(saved).requestedUrl, first.requestedUrl);
  await scan(page, second.requestedUrl);
  const current = JSON.parse((await readDownload(page, '#export-json-button')).text);
  assert.equal(current.requestedUrl, second.requestedUrl);
  assert.equal(current.pages[0].html, good);
  assert.equal(await fs.readFile(destination, 'utf8'), saved);
  await page.reload();
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#export-json-button').isDisabled(), true);
  assert.equal(await fs.readFile(destination, 'utf8'), saved);
  const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }));
  assert.deepEqual(storage, { local: 0, session: 0, cookie: '' });
  assert.deepEqual(errors, []);
});
