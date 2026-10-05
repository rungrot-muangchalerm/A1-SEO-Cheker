const test = require('node:test');
const assert = require('node:assert/strict');
const timers = require('node:timers/promises');
const html = require('../app/service/html.service');
const sitemap = require('../app/service/sitemap.service');
const checksService = require('../app/service/sitemap-checks.service');
const audit = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');

const base = 'https://site.example';
const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const map = (urls) => '<urlset xmlns="' + ns + '">' + urls.map((url) => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>';
const markup = (title, path, extra = '') => '<title>' + title + '</title><meta name="description" content="' + title + '"><link rel="canonical" href="' + path + '">' + extra;
const xml = (body) => ({ html: body, headers: { 'content-type': 'application/xml; charset=utf-8' } });
function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
}
function page(path = '/', extra = '', headers = {}) {
  const result = { finalUrl: base + path, html: markup(path, path, extra), status: 200, headers, rawHeaders: [], redirects: [] };
  result.metadata = html.parse(result);
  return result;
}
function crawl(pages, maps, extraResponses = []) {
  return { page: pages[0], pages, skipped: [], discovery: { origin: base, sitemaps: maps },
    responses: [...pages.map((entry) => ({ requestedUrl: entry.finalUrl, url: entry.finalUrl, status: entry.status,
      headers: entry.headers, rawHeaders: entry.rawHeaders, redirects: [], terminal: true })), ...extraResponses] };
}
const parsed = (body, path = '/sitemap.xml') => ({ url: base + path, finalUrl: base + path, status: 'checked', httpStatus: 200, ...sitemap.parse(body) });
const findings = (report) => report.siteChecks.filter((entry) => entry.ruleId === 'sitemap-url-target');

test('actual crawl checks URL entries from nested indexes with real HTTP, redirect and noindex source evidence, without refetching aliases', async (t) => {
  clock(t);
  const transport = stubTransport(t, [{ status: 404 }, { html: markup('Root', '/') },
    xml('<sitemapindex xmlns="' + ns + '"><sitemap><loc>' + base + '/child.xml</loc></sitemap></sitemapindex>'),
    xml(map([base + '/missing?q=1&amp;x=2', base + '/alias', base + '/hidden', base + '/good'])),
    { status: 404, html: '{}', headers: { 'content-type': 'application/json' } }, { status: 302, headers: { location: '/good' } },
    { html: markup('Good', '/good') }, { html: markup('Hidden', '/hidden', '<meta name="googlebot" content="noindex">') }]);
  const report = (await audit.create({ url: base + '/', crawl: true })).data;
  const result = findings(report);
  assert.equal(result.length, 3);
  const missing = result.find((entry) => entry.details.httpStatus === 404);
  assert.equal(missing.details.target, base + '/missing?q=1&x=2');
  assert.equal(missing.outcome, 'fail');
  const loc = missing.evidence.find((entry) => entry.kind === 'sitemap');
  assert.equal(loc.sourceUrl, base + '/child.xml');
  assert.equal(loc.entryIndex, 1);
  assert.equal(loc.value, base + '/missing?q=1&x=2');
  assert.equal(loc.sourceFormat, 'parsed-xml-value');
  assert.equal(loc.location, undefined);
  const alias = result.find((entry) => entry.details.target.endsWith('/alias'));
  assert.equal(alias.details.httpStatus, 200);
  assert.equal(alias.outcome, 'review');
  assert.equal(alias.details.redirects[0].status, 302);
  assert.equal(transport.calls.filter((entry) => entry.url.endsWith('/good')).length, 1);
  const hidden = result.find((entry) => entry.details.target.endsWith('/hidden'));
  assert.equal(hidden.details.targetNoindex, true);
  assert.equal(hidden.outcome, 'review');
  assert.ok(hidden.evidence.some((entry) => entry.name === 'googlebot' && entry.location.startLine && entry.sourceUrl.endsWith('/hidden')));
  assert.equal(report.pages.length, 3);
  assert.equal(report.summary.warning, 1);
  assert.equal(report.summary.affected, 3);
  assert.ok(!report.pages.some((entry) => entry.finalUrl === missing.details.target));
  assert.equal(report.siteChecks.find((entry) => entry.ruleId === 'sitemap-url-coverage').outcome, 'pass');
});

test('a healthy parsed urlset passes only its observed targets; absent maps are unavailable, not mandatory-file issues', () => {
  const root = page();
  const result = checksService.analyze(crawl([root], [parsed(map([base + '/']))]));
  assert.equal(result.length, 1);
  assert.equal(result[0].outcome, 'pass');
  assert.equal(result[0].details.examinedTargets, 1);
  const absent = checksService.analyze(crawl([root], [{ url: base + '/sitemap.xml', status: 'not-checked', httpStatus: 404 }]));
  assert.ok(absent.every((entry) => entry.outcome === 'not-checked'));
  assert.equal(absent.at(-1).reason, 'no-readable-urlset');
});

test('blocked, foreign and network-failed targets never become invented broken links; an observed redirect remains a fact with incomplete destination', () => {
  const data = crawl([page()], [parsed(map([base + '/blocked', base + '/offline', 'https://outside.example/', base + '/redirect']))],
    [{ url: base + '/redirect', requestedUrl: base + '/redirect', status: 302, terminal: false, fetchError: 'OUTSIDE_SCOPE',
      redirects: [{ url: base + '/redirect', status: 302, destination: 'https://outside.example/' }] }]);
  data.skipped = [{ url: base + '/blocked', reason: 'ROBOTS_BLOCKED' }, { url: base + '/offline', reason: 'NETWORK_ERROR' }];
  const result = checksService.analyze(data);
  assert.deepEqual(result.slice(0, 3).map((entry) => entry.reason), ['ROBOTS_BLOCKED', 'NETWORK_ERROR', 'outside-origin']);
  assert.ok(result.slice(0, 3).every((entry) => entry.outcome === 'not-checked' && entry.details.httpStatus === null));
  assert.equal(result[3].outcome, 'review');
  assert.equal(result[3].complete, false);
  assert.equal(result[3].details.httpStatus, null);
  assert.equal(result[3].details.lastHttpStatus, 302);
  assert.ok(!result.some((entry) => entry.outcome === 'fail'));
});

test('noindex respects agent scope and raw headers; an unread HTML body cannot establish absence of noindex', () => {
  const root = page();
  const header = page('/header', '', {});
  header.rawHeaders = ['X-Robots-Tag', 'googlebot-news: noindex', 'X-Robots-Tag', 'noindex'];
  const allowed = page('/allowed', '<meta name="googlebot-news" content="noindex"><meta name="robots" content="nofollow">');
  const maps = [parsed(map([base + '/header', base + '/allowed', base + '/pdf']))];
  const result = checksService.analyze(crawl([root, header, allowed], maps,
    [{ url: base + '/pdf', status: 200, terminal: true, headers: { 'content-type': 'application/pdf' } }]));
  const restricted = result.find((entry) => entry.details.target === base + '/header');
  assert.equal(restricted.details.targetNoindex, true);
  assert.ok(restricted.evidence.some((entry) => entry.kind === 'header' && entry.name === 'X-Robots-Tag'));
  assert.ok(!result.some((entry) => entry.details.target === base + '/allowed'));
  const pdf = result.find((entry) => entry.details.target === base + '/pdf');
  assert.equal(pdf.outcome, 'not-checked');
  assert.equal(pdf.reason, 'target-body-unavailable');
  assert.equal(pdf.details.httpStatus, 200);
  assert.equal(pdf.details.targetNoindex, null);
});

test('invalid loc and fetch-policy exclusions stay distinct, with bounded parsed-value evidence and no fabricated HTTP status', () => {
  const urls = ['/relative', 'javascript:alert(1)', 'https://site.example:8080/path', 'https://user:password@site.example/path', base + '/' + 'x'.repeat(8200)];
  const result = checksService.analyze(crawl([page()], [parsed(map(urls))]));
  const invalid = result.find((entry) => entry.ruleId === 'sitemap-invalid-loc');
  assert.equal(invalid.outcome, 'fail');
  assert.equal(invalid.details.invalidEntries, 2);
  assert.equal(invalid.evidence[0].entryIndex, 1);
  assert.equal(invalid.evidence[0].value, '/relative');
  const restricted = result.find((entry) => entry.ruleId === 'sitemap-restricted-loc');
  assert.equal(restricted.outcome, 'not-checked');
  assert.equal(restricted.details.restrictedEntries, 3);
  assert.equal(restricted.details.httpStatus, undefined);
  assert.equal(result.at(-1).outcome, 'not-checked');
});

test('duplicate entries retain every sitemap file but target and total evidence caps disclose omitted proof', () => {
  const body = map(Array.from({ length: 60 }, () => base + '/missing'));
  const data = crawl([page()], [parsed(body), parsed(body, '/other.xml')], [{ url: base + '/missing', status: 404, terminal: true }]);
  const result = checksService.analyze(data);
  const missing = result.find((entry) => entry.ruleId === 'sitemap-url-target');
  assert.equal(missing.outcome, 'fail');
  assert.equal(missing.complete, false);
  assert.equal(missing.evidence.length, checksService.limits.maxEvidencePerTarget);
  assert.equal(missing.details.evidenceOmitted, 71);
  assert.deepEqual(missing.details.sitemapFiles, [base + '/other.xml', base + '/sitemap.xml']);
  assert.ok(missing.evidence.some((entry) => entry.kind === 'response' && entry.status === 404));
  const many = checksService.analyze(crawl([page()], [parsed(map(Array.from({ length: 205 }, (_, i) => base + '/p-' + i)))]));
  assert.equal(many.at(-1).details.retainedTargets, 200);
  assert.equal(many.at(-1).details.omittedEntries, 5);
  assert.equal(many.at(-1).outcome, 'not-checked');
});

test('loops and access restrictions use real observed HTTP; noindex extraction limits remain disclosed even when a finding is proven', () => {
  const limited = page('/hidden', '<meta name="robots" content="noindex">');
  limited.metadata.truncated.push('meta');
  const data = crawl([page(), limited], [parsed(map([base + '/loop', base + '/restricted', base + '/hidden']))],
    [{ url: base + '/loop', status: 302, terminal: false, fetchError: 'REDIRECT_LOOP', redirects: [{ url: base + '/loop', status: 302, destination: base + '/loop' }] },
      { url: base + '/restricted', status: 429, terminal: true }]);
  const result = checksService.analyze(data);
  assert.equal(result[0].outcome, 'fail');
  assert.equal(result[0].details.httpStatus, null);
  assert.equal(result[0].details.lastHttpStatus, 302);
  assert.equal(result[1].outcome, 'review');
  assert.equal(result[1].details.httpStatus, 429);
  assert.equal(result[2].outcome, 'review');
  assert.equal(result[2].complete, false);
  assert.equal(result[2].reason, 'target-robots-incomplete');
});

test('changing sitemap loc and noindex bytes changes the current report without retaining earlier sitemap findings', async (t) => {
  clock(t);
  stubTransport(t, [{ status: 404 }, { html: markup('Root', '/') }, xml(map([base + '/hidden'])),
    { html: markup('Hidden', '/hidden', '<meta name="robots" content="noindex">') },
    { status: 404 }, { html: markup('Root', '/') }, xml(map([base + '/good'])), { html: markup('Good', '/good') }]);
  const first = (await audit.create({ url: base + '/', crawl: true })).data;
  const second = (await audit.create({ url: base + '/', crawl: true })).data;
  assert.equal(findings(first).length, 1);
  assert.equal(findings(first)[0].details.targetNoindex, true);
  assert.equal(findings(second).length, 0);
  assert.equal(second.issues.length, 0);
  assert.equal(findings(first)[0].details.target, base + '/hidden');
});

test('browser shows parsed loc proof as text, with real HTTP and manual CSV; unfetched resources do not have dead page buttons', async (t) => {
  clock(t);
  const target = base + '/missing?x=&lt;img src=x onerror=&quot;globalThis.__sitemapXss=true&quot;&gt;';
  stubTransport(t, [{ status: 404 }, { html: markup('Root', '/') }, xml(map([target])),
    { status: 404, headers: { 'content-type': 'application/json' }, html: '{}' }]);
  const { page: browserPage, errors } = await frontend(t, { width: 390, height: 844 });
  await browserPage.locator('#crawl-pages').check();
  await scan(browserPage, base + '/');
  await browserPage.locator('[data-issue-id^="sitemap-url-target:"]').click();
  assert.ok((await browserPage.locator('#detail-content').textContent()).includes('HTTP 404'));
  assert.ok((await browserPage.locator('#detail-content').textContent()).includes('loc #1'));
  assert.ok((await browserPage.locator('#detail-content').textContent()).includes(base + '/sitemap.xml'));
  assert.equal(await browserPage.locator('#detail-content [data-evidence-kind="sitemap"]').count(), 1);
  assert.equal(await browserPage.locator('#detail-content [data-page-url]').count(), 0);
  assert.equal(await browserPage.locator('#detail-content [data-unfetched-url]').count(), 1);
  assert.equal(await browserPage.locator('#detail-content img').count(), 0);
  assert.equal(await browserPage.evaluate(() => globalThis.__sitemapXss), undefined);
  assert.equal(await browserPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.ok((await browserPage.locator('#affected-summary').textContent()).includes('1 URL'));
  await browserPage.locator('#issue-drawer .btn-close').click();
  await browserPage.locator('#issue-drawer').waitFor({ state: 'hidden' });
  const [download] = await Promise.all([browserPage.waitForEvent('download'), browserPage.locator('#export-button').click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  assert.ok(csv.includes('sitemap-url-target'));
  assert.ok(csv.includes('parsed-xml-value'));
  assert.ok(csv.includes(base + '/sitemap.xml'));
  assert.ok(csv.includes('404'));
  await browserPage.reload();
  assert.equal(await browserPage.locator('#website-url').inputValue(), '');
  assert.equal(await browserPage.locator('#detail-content').textContent(), '');
  assert.deepEqual(errors, []);
});
