const test = require('node:test');
const assert = require('node:assert/strict');
const website = require('../app/data/website.data');
const audit = require('../app/service/audit.service');
const crawl = require('../app/service/crawl.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');

const markup = (title, links = '') => '<title>' + title + '</title><meta name="description" content="' + title + '"><link rel="canonical" href="/">' + links;
const scenario = () => [
  { html: 'User-agent: Googlebot\nDisallow: /allowed\nUser-agent: SEOChecker\nDisallow: /blocked\nAllow: /', headers: { 'content-type': 'text/plain' } },
  { html: markup('Root', '<a href="/allowed#part">A</a><a href="/blocked">B</a><a href="https://outside.example/">Out</a>') },
  { status: 404 },
  { html: markup('Allowed', '<a href="/#loop">Root</a><a href="/next?v=1">One</a><a href="/next?v=2">Two</a>') },
  { html: markup('One', '<a href="/allowed#repeat">Back</a>') },
  { status: 404, html: markup('Missing') }
];

test('bounded crawl actually fetches links discovered on later pages, preserves queries and respects SEOChecker instead of Googlebot', async (t) => {
  const transport = stubTransport(t, scenario());
  const result = await audit.create({ url: 'https://site.example/', crawl: true, maxPages: 9999, minIntervalMs: 0 });
  assert.equal(result.ok, true);
  const report = result.data;
  assert.deepEqual(transport.calls.map((entry) => entry.url), ['https://site.example/robots.txt', 'https://site.example/',
    'https://site.example/sitemap.xml', 'https://site.example/allowed', 'https://site.example/next?v=1', 'https://site.example/next?v=2']);
  assert.deepEqual(report.pages.map((entry) => entry.metadata.title), ['Root', 'Allowed', 'One', 'Missing']);
  assert.equal(report.scope.type, 'same-origin-crawl');
  assert.equal(report.scope.maxPages, 20);
  assert.equal(report.coverage.discovered, 5);
  assert.equal(report.coverage.fetched, 4);
  assert.equal(report.coverage.analyzed, 4);
  assert.deepEqual(report.coverage.skipped, [{ url: 'https://site.example/blocked', reason: 'ROBOTS_BLOCKED' }]);
  assert.equal(report.summary.pages, 4);
  assert.equal(report.summary.critical, 1);
  assert.equal(report.summary.review, 4);
  assert.equal(report.summary.affected, 3);
  assert.equal(report.pages.flatMap((page) => page.checks).length, 32);
  assert.equal(report.summary.warning, 1);
  assert.equal(report.summary.checks.pass + report.summary.checks.fail + report.summary.checks.review, 39);
  assert.equal(new Set(report.issues.map((entry) => entry.id)).size, report.issues.length);
  assert.equal(report.pages[1].robots.crawlerAllowed, true);
  assert.equal(report.pages[1].robots.googlebotAllowed, false);
  assert.equal(report.crawl.stats.requests, transport.calls.length);
  assert.equal(report.crawl.stats.htmlBytes, report.pages.reduce((sum, entry) => sum + entry.bytes, 0));
  assert.equal(report.crawl.limits.maxConcurrency, 1);
});

test('every socket including robots, sitemap and redirect hops is paced and none overlap', async (t) => {
  const starts = [];
  let active = 0;
  let peak = 0;
  const transport = stubTransport(t, [
    { status: 404 }, { html: markup('Root', '<a href="/alias">Alias</a>') }, { status: 404 },
    { status: 302, headers: { location: '/final' } }, { html: markup('Final') }
  ]);
  const original = require('node:https').request;
  t.mock.method(require('node:https'), 'request', (url, options, callback) => {
    active++;
    peak = Math.max(peak, active);
    starts.push(Date.now());
    return original(url, options, (response) => {
      response.once('close', () => { active--; });
      callback(response);
    });
  });
  const result = await audit.create({ url: 'https://site.example/', crawl: true });
  assert.equal(result.ok, true);
  assert.equal(starts.length, 5);
  assert.equal(peak, 1);
  assert.equal(active, 0);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= crawl.limits.minIntervalMs - 15);
  assert.equal(result.data.pages[1].finalUrl, 'https://site.example/final');
  assert.equal(transport.calls.filter((entry) => entry.url.endsWith('/final')).length, 1);
});

test('robot rules apply before the requested root, redirect destinations and sitemap sockets; unavailable rules do not become allowed', async (t) => {
  const blocked = stubTransport(t, [{ html: 'User-agent: SEOChecker\nDisallow: /' }]);
  const result = await audit.create({ url: 'https://site.example/', crawl: true });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROBOTS_BLOCKED');
  assert.equal(blocked.calls.length, 1);
  t.mock.restoreAll();
  const unavailable = stubTransport(t, [{ status: 503 }]);
  assert.equal((await audit.create({ url: 'https://site.example/', crawl: true })).code, 'ROBOTS_UNKNOWN');
  assert.equal(unavailable.calls.length, 1);
  t.mock.restoreAll();
  const transport = stubTransport(t, [
    { html: 'User-agent: SEOChecker\nDisallow: /hidden\nDisallow: /sitemap.xml' },
    { html: markup('Root', '<a href="/alias">Alias</a>') },
    { status: 302, headers: { location: '/hidden' } }
  ]);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  assert.equal(report.discovery.sitemaps[0].reason, 'ROBOTS_BLOCKED');
  assert.equal(report.coverage.skipped[0].reason, 'ROBOTS_BLOCKED');
  assert.deepEqual(transport.calls.map((entry) => new URL(entry.url).pathname), ['/robots.txt', '/', '/alias']);
});

test('crawl delay greater than the default is honored without keeping a policy across rounds', async (t) => {
  const times = [];
  const transport = stubTransport(t, [{ html: 'User-agent: SEOChecker\nCrawl-delay: 0.65' }, { html: markup('Root') }, { status: 404 },
    { status: 404 }, { html: markup('Second') }, { status: 404 }]);
  const original = require('node:https').request;
  t.mock.method(require('node:https'), 'request', (...args) => { times.push(Date.now()); return original(...args); });
  assert.equal((await audit.create({ url: 'https://site.example/', crawl: true })).ok, true);
  assert.ok(times[1] - times[0] >= 635);
  assert.ok(times[2] - times[1] >= 635);
  assert.equal((await audit.create({ url: 'https://site.example/', crawl: true })).data.pages[0].metadata.title, 'Second');
  assert.equal(transport.calls.filter((entry) => entry.url.endsWith('/robots.txt')).length, 2);
});

test('front-end crawl opt-in reports actual page counts and skipped reasons, with no implicit crawling or refresh recovery', async (t) => {
  stubTransport(t, scenario());
  const { page, errors } = await frontend(t, { width: 390, height: 844 });
  assert.equal(await page.locator('#crawl-pages').isChecked(), false);
  await page.locator('#crawl-pages').check();
  await scan(page, 'https://site.example/');
  assert.equal(await page.locator('#summary-pages').textContent(), '4');
  await page.locator('#skipped-section summary').click();
  assert.ok((await page.locator('#skipped-list').textContent()).includes('ROBOTS_BLOCKED'));
  await page.locator('#pages-tab').click();
  assert.equal(await page.locator('#page-rows tr').count(), 4);
  const missing = page.locator('[data-page-url="https://site.example/next?v=2"]');
  await missing.click();
  assert.ok((await page.locator('#detail-content').textContent()).includes('404'));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(await page.locator('#crawl-pages').isChecked(), false);
  assert.equal(await page.locator('#skipped-list').textContent(), '');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
});
