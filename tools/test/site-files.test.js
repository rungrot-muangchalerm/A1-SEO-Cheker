const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const siteFiles = require('../../app/service/site-files.service');
const audit = require('../../app/service/audit.service');
const robots = require('../../app/service/robots.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, bad, clickExport } = require('./helpers/frontend');

const origin = 'https://site.example';
const page = (status = 404, extra = {}) => ({ finalUrl: origin + '/folder/', robots: {
  url: origin + '/robots.txt', httpStatus: status, status: status === 200 ? 'checked' : 'absent', ...extra
} });
const discovery = (entries, extra = {}) => ({ sitemaps: entries, skipped: [], limitReached: false, ...extra });
const missingMap = (status = 404) => ({ url: origin + '/sitemap.xml', httpStatus: status,
  status: 'not-checked', reason: 'sitemap-http-status' });
const xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/</loc></url></urlset>';

async function download(browserPage, selector) {
  const event = browserPage.waitForEvent('download');
  await clickExport(browserPage, selector);
  const stream = await (await event).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('404 and 410 produce optional, scoped advice with actual URLs and HTTP evidence', () => {
  for (const status of [404, 410]) {
    const files = siteFiles.analyze(page(status), discovery([missingMap(status)]));
    assert.deepEqual(files.map(entry => entry.status), ['missing', 'missing']);
    assert.ok(files.every(entry => entry.recommendation && entry.steps.length && entry.scope === 'checked-locations'));
    assert.equal(files[0].evidence[0].sourceUrl, origin + '/robots.txt');
    assert.equal(files[1].evidence[0].httpStatus, status);
    assert.ok(files[0].recommendation.includes('\u0e44\u0e21\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19'));
    assert.ok(files[1].recommendation.includes('\u0e44\u0e21\u0e48\u0e23\u0e31\u0e1a\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19'));
  }
});

test('access failures, throttling and server errors never become missing-file recommendations', () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const files = siteFiles.analyze(page(status), discovery([missingMap(status)]));
    assert.ok(files.every(entry => entry.status === 'unavailable' && entry.recommendation === null));
    assert.ok(files.every(entry => entry.evidence[0].httpStatus === status));
  }
  const files = siteFiles.analyze(page(undefined, { httpStatus: undefined, status: 'not-checked', reason: 'DNS_FAILED' }),
    discovery([{ url: origin + '/sitemap.xml', status: 'not-checked', reason: 'TIMEOUT' }]));
  assert.ok(files.every(entry => entry.status === 'unavailable'));
  assert.ok(files.every(entry => entry.evidence[0].kind === 'observation' && entry.evidence[0].httpStatus === null));
});

test('a readable custom sitemap prevents a false missing-file alert when sitemap.xml is 404', () => {
  const files = siteFiles.analyze(page(200), discovery([missingMap(), {
    url: origin + '/custom.xml', finalUrl: origin + '/maps/index.xml', httpStatus: 200,
    status: 'checked', type: 'sitemapindex', namespaceVerified: true
  }]));
  assert.deepEqual(files.map(entry => entry.status), ['found', 'found']);
  assert.equal(files[1].recommendation, null);
  assert.equal(files[1].evidence[1].finalUrl, origin + '/maps/index.xml');
});

test('disabled discovery, limited discovery and excluded candidates are not proof of absence', () => {
  assert.equal(siteFiles.analyze(page(), undefined)[1].reason, 'not-requested');
  for (const extra of [{ limitReached: true }, { skipped: [{ kind: 'sitemap', reason: 'outside-origin' }] }]) {
    assert.equal(siteFiles.analyze(page(), discovery([missingMap()], extra))[1].status, 'unavailable');
  }
  assert.equal(siteFiles.analyze(page(), discovery([]))[1].status, 'unavailable');
});

test('evidence is bounded and omitted observations are disclosed', () => {
  const files = siteFiles.analyze(page(), discovery(Array.from({ length: 65 }, (_, index) => ({
    ...missingMap(), url: origin + '/map-' + index + '.xml'
  }))));
  assert.equal(files[1].evidence.length, 50);
  assert.equal(files[1].evidenceOmitted, 15);
});

test('an HTML robots fallback is disclosed without changing the existing crawl decision', async t => {
  stubTransport(t, [{ html: '<!doctype html><html><body>Fallback</body></html>', headers: { 'content-type': 'text/html' } }]);
  const result = await robots.load(origin + '/');
  assert.equal(result.bodyFormat, 'html');
  assert.equal(result.crawlerAllowed, true);
  const [file] = siteFiles.analyze({ finalUrl: origin + '/', robots: result });
  assert.equal(file.status, 'invalid');
  assert.equal(file.evidence[0].httpStatus, 200);
});

test('API service reports optional missing files without inventing SEO failures or making additional requests', async t => {
  const transport = stubTransport(t, [{ html: bad }, { status: 404 }, { status: 404 }]);
  const result = await audit.create({ url: origin + '/', discover: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.siteFiles.map(entry => entry.status), ['missing', 'missing']);
  assert.ok(!result.data.issues.some(entry => ['robots-file', 'sitemap-file'].includes(entry.ruleId)));
  assert.equal(result.data.pages[0].checks.find(entry => entry.ruleId === 'robots-crawling').outcome, 'pass');
  assert.equal(transport.calls.length, 3);
});

test('malformed XML and HTML content preserve observed HTTP evidence rather than appearing missing', async t => {
  for (const headers of [{ 'content-type': 'application/xml' }, { 'content-type': 'text/html' }]) {
    stubTransport(t, [{ html: bad }, { status: 404 }, { html: '<html><body>Fallback</body></html>', headers }]);
    const result = await audit.create({ url: origin + '/', discover: true });
    assert.equal(result.ok, true);
    const file = result.data.siteFiles[1];
    assert.equal(file.status, 'invalid');
    assert.equal(file.evidence[0].httpStatus, 200);
    assert.equal(file.evidence[0].finalUrl, origin + '/sitemap.xml');
  }
});

test('recommendations are visible without opening issue details and survive JSON/XLSX exports', { timeout: 30000 }, async t => {
  stubTransport(t, [{ html: bad }, { status: 404 }, { status: 404 }]);
  let result;
  const create = audit.create;
  t.mock.method(audit, 'create', async (...args) => { const outcome = await create(...args); result = outcome.data; return outcome; });
  const { page: browserPage, errors } = await frontend(t);
  await scan(browserPage, origin + '/', { discover: true });
  assert.equal(await browserPage.locator('#site-files-section').isVisible(), true);
  assert.equal(await browserPage.locator('[data-file-status="missing"]').count(), 2);
  assert.ok((await browserPage.locator('#site-files-list').textContent()).includes('\u0e1e\u0e34\u0e08\u0e32\u0e23\u0e13\u0e32\u0e40\u0e1e\u0e34\u0e48\u0e21'));
  const exported = JSON.parse((await download(browserPage, '#export-json-button')).toString());
  assert.deepEqual(exported.siteFiles, result.siteFiles);
  const selected = JSON.parse((await download(browserPage, '#export-button')).toString());
  assert.deepEqual(selected.siteFiles, result.siteFiles);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await download(browserPage, '#export-xlsx-button'));
  const sheet = workbook.getWorksheet('Site Files');
  assert.equal(sheet.getCell('A2').value, 'robots-file');
  assert.equal(sheet.getCell('C2').value, 'missing');
  assert.deepEqual(JSON.parse(sheet.getCell('G2').value), result.siteFiles[0].evidence);
  if (process.env.SEO_TEST_SCREENSHOT_PREFIX) await browserPage.screenshot({ path: process.env.SEO_TEST_SCREENSHOT_PREFIX + '-desktop.png', fullPage: true });
  await browserPage.reload();
  await browserPage.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(await browserPage.locator('#site-files-section').isVisible(), false);
  assert.equal(await browserPage.locator('#site-files-list').textContent(), '');
  assert.deepEqual(errors, []);
});

test('mobile shows found custom sitemap URLs without overflowing or recommending a duplicate file', { timeout: 30000 }, async t => {
  const custom = origin + '/maps/' + 'long-name-'.repeat(55) + '.xml';
  stubTransport(t, [{ html: bad }, { html: 'User-agent: *\nAllow: /\nSitemap: ' + custom },
    { html: xml, headers: { 'content-type': 'application/xml' } }, { status: 404 }]);
  const { page: browserPage, errors } = await frontend(t, { width: 320, height: 740 });
  await scan(browserPage, origin + '/', { discover: true });
  assert.equal(await browserPage.locator('[data-file-status="found"]').count(), 2);
  assert.equal(await browserPage.locator('[data-file-recommendation]').count(), 0);
  await browserPage.locator('[data-site-file="sitemap-file"] summary').click();
  assert.ok((await browserPage.locator('[data-site-file="sitemap-file"]').textContent()).includes(custom));
  assert.equal(await browserPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  if (process.env.SEO_TEST_SCREENSHOT_PREFIX) await browserPage.screenshot({ path: process.env.SEO_TEST_SCREENSHOT_PREFIX + '-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
});
