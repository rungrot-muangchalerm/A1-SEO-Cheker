const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/small-crawl-budgets').configure();
const timers = require('node:timers/promises');
const website = require('../../app/data/website.data');
const audit = require('../../app/service/audit.service');
const html = require('../../app/service/html.service');
const links = require('../../app/service/internal-links.service');
const responseModel = require('../../app/model/response.model');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, setAuditOptions } = require('./helpers/frontend');

function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
}
const markup = (title, path, anchors = '') => '<title>' + title + '</title><meta name="description" content="' + title +
  '"><link rel="canonical" href="' + path + '">' + anchors;
const rules = (report) => report.siteChecks.filter((entry) => entry.ruleId === 'internal-link-target');
const response = (path, status) => ({ requestedUrl: 'https://site.example' + path, url: 'https://site.example' + path,
  status, redirects: [], terminal: true });

test('HTTP evidence survives non-HTML MIME rejection, but root API failures remain sanitized', async (t) => {
  stubTransport(t, [{ status: 404, html: '{"secret":"upstream detail"}', headers: { 'content-type': 'application/json' } },
    { status: 404, html: 'private source', headers: { 'content-type': 'application/json' } }]);
  let error;
  try { await website.fetchPage('https://site.example/missing'); } catch (caught) { error = caught; }
  assert.equal(error.code, 'UNSUPPORTED_TYPE');
  assert.equal(error.observation.status, 404);
  assert.equal(error.observation.url, 'https://site.example/missing');
  assert.equal(error.observation.requestedUrl, 'https://site.example/missing');
  assert.equal(error.observation.terminal, true);
  assert.equal(error.observation.html, undefined);
  assert.deepEqual(await audit.create({ url: 'https://site.example/missing' }), { ok: false, code: 'UNSUPPORTED_TYPE' });
});

test('actual crawl reports broken HTML and JSON destinations with every source URL, query and parser location', async (t) => {
  clock(t);
  const transport = stubTransport(t, [{ status: 404 }, { html: markup('Root', '/', '<a href="/source">Source</a><a href="/missing?v=1#fragment">Missing</a><a href="/json?v=2">JSON</a>') },
    { status: 404 }, { html: markup('Source', '/source', '<a href="/missing?v=1">Missing again</a>') },
    { status: 404, html: markup('Missing', '/missing?v=1') }, { status: 410, html: '{}', headers: { 'content-type': 'application/json' } }]);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  const checks = rules(report);
  assert.equal(checks.length, 2);
  const missing = checks.find((entry) => entry.details.httpStatus === 404);
  assert.deepEqual(missing.urls, ['https://site.example/', 'https://site.example/source']);
  assert.equal(missing.details.target, 'https://site.example/missing?v=1');
  assert.equal(missing.outcome, 'fail');
  assert.equal(missing.severity, 'warning');
  assert.equal(missing.evidence.filter((entry) => entry.kind === 'html').length, 2);
  assert.ok(missing.evidence.filter((entry) => entry.kind === 'html').every((entry) => entry.location.startLine));
  const json = checks.find((entry) => entry.details.httpStatus === 410);
  assert.equal(json.details.responseUrl, 'https://site.example/json?v=2');
  assert.equal(report.pages.length, 3);
  assert.equal(report.coverage.fetched, 3);
  assert.equal(report.responses.length, 4);
  assert.equal(report.responses.at(-1).status, 410);
  assert.equal(report.responses.at(-1).html, undefined);
  assert.ok(!report.pages.some((entry) => entry.finalUrl.includes('/json')));
  assert.equal(transport.calls.filter((entry) => entry.url.includes('/missing')).length, 1);
});

test('redirect aliases reuse a known terminal response without fetching it twice; loops keep last 302 distinct from final status', async (t) => {
  clock(t);
  const transport = stubTransport(t, [{ status: 404 }, { html: markup('Root', '/', '<a href="/missing">Missing</a><a href="/alias">Alias</a><a href="/loop">Loop</a>') },
    { status: 404 }, { status: 404, html: markup('Missing', '/missing') },
    { status: 302, headers: { location: '/missing' } },
    { status: 302, headers: { location: '/loop-two' } }, { status: 302, headers: { location: '/loop' } }]);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  const checks = rules(report);
  const alias = checks.find((entry) => entry.details.target.endsWith('/alias'));
  assert.equal(alias.details.httpStatus, 404);
  assert.equal(alias.details.responseUrl, 'https://site.example/missing');
  assert.equal(alias.details.reusedResponse, true);
  assert.equal(alias.details.redirects[0].status, 302);
  assert.equal(transport.calls.filter((entry) => entry.url.endsWith('/missing')).length, 1);
  const loop = checks.find((entry) => entry.details.target.endsWith('/loop'));
  assert.equal(loop.outcome, 'fail');
  assert.equal(loop.details.httpStatus, null);
  assert.equal(loop.details.lastHttpStatus, 302);
  assert.equal(loop.details.redirects.length, 2);
  assert.ok(!loop.found.includes('HTTP 404'));
});

test('healthy non-HTML resources are not broken; intentional access restrictions and rate limiting require review', async (t) => {
  clock(t);
  stubTransport(t, [{ status: 404 }, { html: markup('Root', '/', '<a href="/pdf">PDF</a><a href="/login">Login</a><a href="/rate">Rate</a>') },
    { status: 404 }, { html: 'PDF', headers: { 'content-type': 'application/pdf' } },
    { status: 403, html: '{}', headers: { 'content-type': 'application/json' } }, { status: 429, html: '{}', headers: { 'content-type': 'application/json' } }]);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  const checks = rules(report);
  assert.equal(checks.length, 2);
  assert.ok(checks.every((entry) => entry.outcome === 'review'));
  assert.deepEqual(checks.map((entry) => entry.details.httpStatus), [403, 429]);
  assert.ok(!report.issues.some((entry) => entry.details?.target?.endsWith('/pdf')));
});

test('blocked, failed or outside-scope redirect targets remain unknown, never invented 404s or external requests', async (t) => {
  clock(t);
  const transport = stubTransport(t, [{ html: 'User-agent: SEOChecker\nDisallow: /blocked' },
    { html: markup('Root', '/', '<a href="/blocked">Blocked</a><a href="/offline">Offline</a><a href="/external">Redirect</a><a href="https://elsewhere.example/">External link</a>') },
    { status: 404 }, { networkError: true }, { status: 302, headers: { location: 'https://elsewhere.example/' } }]);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  const checks = rules(report);
  assert.equal(checks.length, 3);
  assert.ok(checks.every((entry) => entry.outcome === 'not-checked' && entry.details.httpStatus === null));
  assert.equal(checks[0].reason, 'ROBOTS_BLOCKED');
  assert.equal(checks[1].reason, 'NETWORK_ERROR');
  assert.equal(checks[2].reason, 'OUTSIDE_SCOPE');
  assert.equal(checks[2].details.lastHttpStatus, 302);
  assert.ok(transport.calls.every((entry) => new URL(entry.url).origin === 'https://site.example'));
  assert.ok(!report.issues.some((entry) => entry.ruleId === 'internal-link-target'));
  assert.ok(report.notChecked.some((entry) => entry.message.includes('/blocked')));
});

test('evidence and target limits, extraction truncation and policy-invalid links disclose missing coverage without losing source URLs', () => {
  const page = { finalUrl: 'https://site.example/', html: '<title>Root</title>' + '<a href="/missing">Missing</a>'.repeat(210) +
    Array.from({ length: 205 }, (_, i) => '<a href="/p-' + i + '">P</a>').join('') + '<a href="https://user:password@site.example/secret">Credentials</a>' };
  page.metadata = html.parse(page);
  page.metadata.truncated.push('links');
  const result = links.analyze({ page, pages: [page], responses: [response('/missing', 404)], skipped: [] });
  const missing = result.find((entry) => entry.details?.target?.endsWith('/missing'));
  assert.equal(missing.complete, false);
  assert.equal(missing.details.evidenceOmitted, 10);
  assert.equal(missing.evidence.filter((entry) => entry.kind === 'html').length, links.limits.maxEvidencePerTarget);
  const coverage = result.at(-1);
  assert.equal(coverage.outcome, 'not-checked');
  assert.equal(coverage.details.retainedTargets, links.limits.maxTargets);
  assert.equal(coverage.details.omittedLinks, 6);
  assert.equal(coverage.details.invalidLinks, 1);
});

test('response lookup strips fragments and default ports but preserves query-specific status and real alias chains', () => {
  const index = responseModel.createIndex([response('/p?v=1', 404), response('/p?v=2', 200),
    { requestedUrl: 'https://site.example/a', url: 'https://site.example/c', status: 410, terminal: true,
      redirects: [{ url: 'https://site.example/a', status: 301, destination: 'https://site.example/b' },
        { url: 'https://site.example/b', status: 302, destination: 'https://site.example/c' }] }]);
  assert.equal(index.get('https://SITE.example:443/p?v=1#fragment').status, 404);
  assert.equal(index.get('https://site.example/p?v=2').status, 200);
  assert.equal(index.get('https://site.example/b').redirects.length, 1);
  assert.equal(index.get('https://site.example/c').redirects.length, 0);
  assert.equal(index.get('https://outside.example/').available, false);
});

test('browser displays actual target status and source evidence; grouped sources and JSON use the same report', async (t) => {
  clock(t);
  stubTransport(t, [{ status: 404 }, { html: markup('Root', '/', '<a href="/source">Source</a><a href="/json">Missing</a>') },
    { status: 404 }, { html: markup('Source', '/source', '<a href="/json">Missing again</a>') },
    { status: 404, html: '{}', headers: { 'content-type': 'application/json' } }]);
  const { page, errors } = await frontend(t);
  setAuditOptions(page, { crawl: true });
  await scan(page, 'https://site.example/');
  await page.locator('#category-filter').selectOption('links');
  assert.equal(await page.locator('#issue-rows tr').count(), 1);
  await page.locator('[data-issue-id^="internal-link-target:"]').click();
  assert.ok((await page.locator('#detail-content').textContent()).includes('HTTP 404'));
  assert.ok((await page.locator('#detail-content').textContent()).includes('https://site.example/json'));
  assert.equal(await page.locator('#detail-content [data-page-url]').count(), 2);
  assert.equal(await page.locator('#detail-content [data-evidence-kind="html"]').count(), 2);
  await page.locator('#detail-content [data-page-url="https://site.example/source"]').click();
  assert.ok((await page.locator('#detail-content').textContent()).includes('Source'));
  await page.locator('#issue-drawer .btn-close').click();
  await page.locator('#issue-drawer').waitFor({ state: 'hidden' });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-button').click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const issue = exported.issues.find(entry => entry.ruleId === 'internal-link-target');
  assert.ok(issue.urls.includes('https://site.example/source'));
  assert.equal(issue.details.target, 'https://site.example/json');
  assert.equal(issue.details.httpStatus, 404);
  assert.deepEqual(errors, []);
});
