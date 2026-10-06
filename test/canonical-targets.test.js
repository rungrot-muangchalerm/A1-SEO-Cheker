const test = require('node:test');
const assert = require('node:assert/strict');
const timers = require('node:timers/promises');
const html = require('../app/service/html.service');
const canonical = require('../app/service/canonical.service');
const audit = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');

const base = 'https://site.example';
const markup = (title, target, extra = '') => '<title>' + title + '</title><meta name="description" content="' + title + '">' +
  (target === null ? '' : '<link rel="canonical" href="' + target + '">') + extra;
function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
}
function page(path, target, extra = '', headers = {}, status = 200) {
  const result = { requestedUrl: base + path, finalUrl: base + path, html: markup(path, target, extra), headers, rawHeaders: [], status, redirects: [] };
  result.metadata = html.parse(result);
  return result;
}
function crawl(pages, extra = []) {
  return { page: pages[0], pages, skipped: [], responses: [...pages.map((entry) => ({ requestedUrl: entry.requestedUrl,
    url: entry.finalUrl, status: entry.status, headers: entry.headers, rawHeaders: entry.rawHeaders, redirects: entry.redirects, terminal: true })), ...extra] };
}
const checks = (report) => report.siteChecks.filter((entry) => entry.ruleId === 'canonical-target');

test('self canonical passes only observed technical facts; a different healthy target requires intent confirmation, not an automatic error', () => {
  const source = page('/variant?q=1', '/main');
  const main = page('/main', '/main');
  const result = canonical.analyze(crawl([source, main]));
  assert.equal(result[0].outcome, 'review');
  assert.equal(result[0].complete, true);
  assert.deepEqual(result[0].urls, [base + '/variant?q=1']);
  assert.equal(result[0].details.httpStatus, 200);
  assert.equal(result[0].details.contentComparison, 'not-performed');
  assert.equal(result[0].details.targetNoindex, false);
  assert.equal(result[1].outcome, 'pass');
  assert.ok(result[0].found.includes(base + '/main'));
  assert.ok(result[0].evidence.some((entry) => entry.kind === 'html' && entry.location.startLine));
});

test('crawl follows canonical-only candidates, preserving queries, redirect evidence and existing per-round budgets', async (t) => {
  clock(t);
  const transport = stubTransport(t, [{ status: 404 }, { html: markup('Variant', '/alias?q=1') }, { status: 404 },
    { status: 301, headers: { location: '/main?q=1' } }, { html: markup('Main', '/main?q=1') }]);
  const report = (await audit.create({ url: base + '/', crawl: true })).data;
  assert.deepEqual(transport.calls.map((entry) => entry.url), [base + '/robots.txt', base + '/', base + '/sitemap.xml', base + '/alias?q=1', base + '/main?q=1']);
  assert.equal(report.pages.length, 2);
  assert.equal(report.crawl.stats.requests, 5);
  assert.equal(report.crawl.limits.maxPages, 5000);
  assert.ok(report.discovery.urls.find((entry) => entry.url === base + '/alias?q=1').sources.some((entry) => entry.kind === 'html-canonical'));
  const source = checks(report)[0];
  assert.equal(source.details.httpStatus, 200);
  assert.equal(source.details.responseUrl, base + '/main?q=1');
  assert.equal(source.details.redirects[0].status, 301);
  assert.equal(source.outcome, 'review');
  assert.ok(!report.notChecked.some((entry) => entry.id === 'canonical-target' && entry.reason === 'not-implemented'));
});

test('real broken non-HTML canonical targets fail with actual HTTP status; access restrictions remain review', async (t) => {
  clock(t);
  stubTransport(t, [{ status: 404 }, { html: markup('Root', '/missing') }, { status: 404 },
    { status: 410, headers: { 'content-type': 'application/json' } }]);
  const report = (await audit.create({ url: base + '/', crawl: true })).data;
  assert.equal(report.pages.length, 1);
  assert.equal(checks(report)[0].outcome, 'fail');
  assert.equal(checks(report)[0].details.httpStatus, 410);
  assert.equal(checks(report)[0].complete, true);
  const restricted = canonical.analyze(crawl([page('/', '/private')], [{ url: base + '/private', requestedUrl: base + '/private', status: 403, terminal: true }]));
  assert.equal(restricted[0].outcome, 'review');
  assert.equal(restricted[0].details.httpStatus, 403);
});

test('target meta/header noindex and canonical chains/cycles have target proof but do not infer accidental intent', () => {
  const source = page('/variant', '/main');
  const target = page('/main', '/variant', '<meta name="googlebot" content="noindex">');
  const result = canonical.analyze(crawl([source, target]));
  assert.equal(result[0].outcome, 'review');
  assert.equal(result[0].details.targetNoindex, true);
  assert.ok(result[0].details.facts.some((entry) => entry.code === 'canonical-cycle'));
  assert.ok(result[0].evidence.some((entry) => entry.sourceUrl === base + '/main' && entry.name === 'googlebot' && entry.location.startLine));
  const headerTarget = page('/main', null, '', { 'x-robots-tag': 'googlebot: noindex', link: '</other>; rel="canonical"' });
  const chain = canonical.analyze(crawl([source, headerTarget]))[0];
  assert.ok(chain.details.facts.some((entry) => entry.code === 'canonical-chain'));
  assert.ok(chain.evidence.some((entry) => entry.kind === 'header' && entry.name === 'X-Robots-Tag' && entry.sourceUrl.endsWith('/main')));
  assert.ok(chain.evidence.some((entry) => entry.kind === 'header' && entry.name === 'Link'));
  const otherAgent = page('/main', '/main', '<meta name="googlebot-news" content="noindex">');
  assert.equal(canonical.analyze(crawl([source, otherAgent]))[0].details.targetNoindex, false);
});

test('unread, foreign, blocked and loop destinations preserve unavailable scope or observed loop without fabricated terminal status', async (t) => {
  clock(t);
  const transport = stubTransport(t, [{ html: 'User-agent: SEOChecker\nDisallow: /blocked' }, { html: markup('Root', '/blocked') }, { status: 404 }]);
  const report = (await audit.create({ url: base + '/', crawl: true })).data;
  const blocked = checks(report)[0];
  assert.equal(blocked.reason, 'ROBOTS_BLOCKED');
  assert.equal(blocked.complete, false);
  assert.equal(blocked.details.httpStatus, null);
  assert.ok(!transport.calls.some((entry) => entry.url.endsWith('/blocked')));
  const foreign = canonical.analyze(crawl([page('/', 'https://outside.example/')]))[0];
  assert.equal(foreign.reason, 'outside-origin');
  assert.equal(foreign.outcome, 'review');
  assert.equal(foreign.complete, false);
  const looping = canonical.analyze(crawl([page('/', '/loop')], [{ requestedUrl: base + '/loop', url: base + '/loop', status: 302,
    terminal: false, fetchError: 'REDIRECT_LOOP', redirects: [{ url: base + '/loop', status: 302, destination: base + '/loop' }] }]))[0];
  assert.equal(looping.outcome, 'fail');
  assert.equal(looping.details.httpStatus, null);
  assert.equal(looping.details.lastHttpStatus, 302);
});

test('missing, conflicting, invalid, qualified or incomplete declarations never produce a passing target comparison', () => {
  const cases = [page('/', null), page('/', '/main', '<link rel="canonical" href="/other">'), page('/', 'javascript:alert(1)'),
    page('/', 'https://user:password@site.example/main'), page('/', '/main', '<link rel="canonical" media="screen" href="/main">')];
  for (const input of cases) assert.notEqual(canonical.analyze(crawl([input]))[0].outcome, 'pass');
  const limited = page('/', '/');
  limited.metadata.truncated.push('canonical');
  assert.equal(canonical.analyze(crawl([limited]))[0].reason, 'canonical-declarations-incomplete');
  const fragment = canonical.analyze(crawl([page('/', '/#part')]))[0];
  assert.equal(fragment.outcome, 'review');
  assert.ok(fragment.details.facts.some((entry) => entry.code === 'canonical-fragment'));
  const incompleteTarget = page('/main', '/main');
  incompleteTarget.metadata.truncated.push('meta');
  const incomplete = canonical.analyze(crawl([page('/', '/main'), incompleteTarget]))[0];
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.details.targetNoindex, null);
});

test('successful non-HTML target is not treated as broken or as having an examined HTML body; headers remain evidence', () => {
  const response = { requestedUrl: base + '/pdf', url: base + '/pdf', status: 200, terminal: true, headers: { 'x-robots-tag': 'noindex' } };
  const result = canonical.analyze(crawl([page('/', '/pdf')], [response]))[0];
  assert.equal(result.outcome, 'review');
  assert.equal(result.details.httpStatus, 200);
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'target-body-unavailable');
  assert.equal(result.details.targetMetadataScope, 'headers-only');
  assert.equal(result.details.targetNoindex, true);
  assert.ok(result.evidence.some((entry) => entry.kind === 'header'));
});

test('target conflicts and evidence caps retain observed findings and explicitly disclose incomplete proof', () => {
  const source = page('/', '/main');
  const target = page('/main', '/main', '<link rel="canonical" href="/different">');
  const result = canonical.analyze(crawl([source, target]))[0];
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'conflicting-canonical-declarations');
  assert.ok(result.evidence.some((entry) => entry.sourceUrl.endsWith('/main') && entry.url?.endsWith('/different')));
  const many = page('/', '/', '<link rel="canonical" href="/">'.repeat(205));
  const limited = canonical.analyze(crawl([many]))[0];
  assert.equal(limited.evidence.length, 200);
  assert.equal(limited.complete, false);
  assert.equal(limited.reason, 'canonical-evidence-limit');
  assert.equal(limited.details.evidenceOmitted, 7);
  assert.equal(limited.outcome, 'not-checked');
  assert.ok(limited.evidence.some((entry) => entry.kind === 'response' && entry.status === 200));
});

test('changing the canonical and target bytes changes the next report without reusing or mutating the previous round', async (t) => {
  clock(t);
  stubTransport(t, [{ status: 404 }, { html: markup('Root', '/missing') }, { status: 404 }, { status: 404 },
    { status: 404 }, { html: markup('Root', '/') }, { status: 404 }]);
  const first = (await audit.create({ url: base + '/', crawl: true })).data;
  const second = (await audit.create({ url: base + '/', crawl: true })).data;
  assert.equal(checks(first)[0].outcome, 'fail');
  assert.equal(checks(first)[0].details.httpStatus, 404);
  assert.equal(checks(second)[0].outcome, 'pass');
  assert.equal(checks(second)[0].details.httpStatus, 200);
  assert.equal(checks(first)[0].details.target, base + '/missing');
  assert.ok(second.responses.every((entry) => entry.url !== base + '/missing'));
});

test('browser shows canonical source, target status and noindex target location from the same real API report', async (t) => {
  clock(t);
  stubTransport(t, [{ status: 404 }, { html: markup('Variant', '/main') }, { status: 404 },
    { html: markup('Main', '/main', '<meta name="robots" content="noindex">') }]);
  const { page: browserPage, errors } = await frontend(t, { width: 390, height: 844 });
  await browserPage.locator('#crawl-pages').check();
  await scan(browserPage, base + '/');
  await browserPage.locator('[data-issue-id="canonical-target:https://site.example/"]').click();
  const details = await browserPage.locator('#detail-content').textContent();
  assert.ok(details.includes(base + '/main'));
  assert.ok(details.includes('HTTP 200'));
  assert.ok(details.includes('noindex'));
  assert.ok(await browserPage.locator('#detail-content [data-evidence-kind="html"]').count() >= 2);
  assert.equal(await browserPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await browserPage.reload();
  assert.equal(await browserPage.locator('#website-url').inputValue(), '');
  assert.equal(await browserPage.locator('#issue-rows').textContent(), '');
  assert.deepEqual(errors, []);
});
