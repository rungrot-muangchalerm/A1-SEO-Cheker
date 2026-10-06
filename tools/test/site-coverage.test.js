const test = require('node:test');
const assert = require('node:assert/strict');
const timers = require('node:timers/promises');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const audit = require('../../app/service/audit.service');
const discovery = require('../../app/service/discovery.service');
const sitemap = require('../../app/service/sitemap.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');

const base = 'https://site.example';
const markup = (name, links = '') => '<title>' + name + '</title><meta name="description" content="' + name + '">' + links;
const anchors = (count) => Array.from({ length: count }, (_, i) => '<a href="/p-' + i + '">Page</a>').join('');
const xml = (count) => '<urlset>' + Array.from({ length: count }, (_, i) => '<url><loc>' + base + '/p-' + i + '</loc></url>').join('') + '</urlset>';

function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
  return (ms) => { now += ms; };
}

test('default site crawl attempts all 74 discovered URLs beyond the old page, request and time limits', async t => {
  const advance = clock(t);
  const responses = [
    { html: 'User-agent: SEOChecker\nDisallow: /p-0$\nDisallow: /p-1$' },
    { html: markup('Root', anchors(73)) }, { status: 404 },
    { status: 410, headers: { 'content-type': 'application/json' } }, { networkError: true },
    { status: 302, headers: { location: '/' } },
    ...Array.from({ length: 68 }, (_, i) => ({ html: markup('Page ' + (i + 5)), status: i + 5 === 70 ? 404 : 200 }))
  ];
  const transport = stubTransport(t, responses);
  const request = require('node:https').request;
  t.mock.method(require('node:https'), 'request', (...args) => { advance(2000); return request(...args); });
  const result = await audit.create({ url: base + '/', crawl: true });
  assert.equal(result.ok, true);
  const report = result.data;
  assert.equal(report.coverage.discovered, 74);
  assert.equal(report.crawl.stats.attemptedPages, 74);
  assert.equal(report.summary.pages, 69);
  assert.equal(report.coverage.skipped.length, 5);
  assert.equal(report.crawl.stopReason, null);
  assert.equal(report.coverage.limitReached, false);
  assert.equal(transport.calls.length, 74);
  assert.ok(Date.now() > 60000);
  assert.ok(report.issues.some(issue => issue.ruleId === 'http-status' && issue.urls.includes(base + '/p-70')));
  assert.ok(report.coverage.skipped.every(entry => !entry.reason.startsWith('CRAWL_')));
});

test('sitemap-only candidates and HTTP issues after target 200 remain part of the site report', async t => {
  clock(t);
  const transport = stubTransport(t, [{ status: 404 }, { html: markup('Root', anchors(300)) },
    { html: xml(350), headers: { 'content-type': 'application/xml' } },
    ...Array.from({ length: 350 }, (_, i) => ({ html: markup('Page ' + i), status: i === 250 || i === 320 ? 404 : 200 }))]);
  const report = (await audit.create({ url: base + '/', crawl: true })).data;
  assert.equal(report.coverage.discovered, 351);
  assert.equal(report.summary.pages, 351);
  assert.equal(report.crawl.stats.attemptedPages, 351);
  assert.equal(report.coverage.skipped.length, 0);
  assert.equal(report.coverage.limitReached, false);
  assert.equal(transport.calls.length, 353);
  assert.ok(report.issues.some(issue => issue.ruleId === 'internal-link-target' && issue.details.target === base + '/p-250'));
  assert.ok(report.issues.some(issue => issue.ruleId === 'sitemap-url-target' && issue.details.target === base + '/p-320'));
});

test('one sitemap can contribute more than 1000 page candidates without the old XML entry cutoff', async t => {
  const parsed = sitemap.parse(xml(1500));
  assert.equal(parsed.entries.length, 1500);
  assert.equal(parsed.truncated, false);
  const page = { finalUrl: base + '/', html: '<title>Root</title>', metadata: { links: [], canonical: [], truncated: [] } };
  t.mock.method(require('../../app/data/website.data'), 'fetchSitemap', async url => ({ finalUrl: url, status: 200, text: xml(1500) }));
  const found = await discovery.discover(page);
  assert.equal(found.urls.length, 1501);
  assert.equal(found.limitReached, false);
});

test('live progress accepts more than 200 skipped URLs and keeps the actual report and refresh behavior', async t => {
  clock(t);
  stubTransport(t, [{ html: 'User-agent: SEOChecker\nDisallow: /p-' }, { html: markup('Root', anchors(250)) }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await page.locator('#crawl-pages').check();
  await scan(page, base + '/');
  assert.equal(await page.locator('#summary-pages').textContent(), '1');
  assert.ok((await page.locator('#skipped-count').textContent()).includes('250'));
  assert.equal(await page.locator('#crawl-limit').isVisible(), false);
  await page.locator('#skipped-section summary').click();
  assert.ok((await page.locator('#skipped-list').textContent()).includes('/p-249'));
  const tempRoot = path.resolve(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(tempRoot, 'seo-site-coverage-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), tempRoot);
    return fs.rm(directory, { recursive: true, force: true });
  });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(directory, width + '.png') });
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#skipped-list').textContent(), '');
  assert.deepEqual(errors, []);
});
