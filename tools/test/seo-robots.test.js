const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../../app/service/html.service');
const seo = require('../../app/service/seo.service');
const directives = require('../../app/service/robots-directives.service');
const website = require('../../app/data/website.data');
const audit = require('../../app/service/audit.service');

function page(source = '<title>Page</title>', headers = {}, status = 200, rawHeaders = []) {
  const result = { finalUrl: 'https://site.example/page', html: source, headers, status, rawHeaders, redirects: [] };
  result.metadata = html.parse(result);
  return result;
}

test('HTTP status reflects the actual response, not a ranking or indexing guarantee', () => {
  for (const [status, outcome, severity] of [[200, 'pass', null], [201, 'pass', null], [304, 'review', 'review'], [404, 'fail', 'critical'], [503, 'fail', 'critical']]) {
    const [check] = seo.analyze(page('', {}, status));
    assert.equal(check.outcome, outcome);
    assert.equal(check.severity, severity);
    assert.equal(check.evidence[0].status, status);
  }
});

test('robots and Googlebot directives are case insensitive, cumulative, and valid in body', () => {
  const target = page('<meta name="ROBOTS" content="INDEX, FOLLOW"><body><meta name="Googlebot" content="NOINDEX"><meta name="robots" content="nofollow">');
  const result = directives.read(target);
  assert.equal(result.noindex, true);
  assert.equal(result.nofollow, true);
  assert.equal(seo.analyze(target)[1].outcome, 'review');
});

test('nofollow, other agents, and value directive none do not invent a Google noindex', () => {
  const target = page('<meta name="bingbot" content="noindex"><meta name="googlebot-news" content="noindex"><meta name="robots" content="nofollow, max-image-preview:none">', { 'x-robots-tag': 'otherbot: noindex, nofollow, googlebot: max-snippet:0' });
  assert.equal(directives.read(target).noindex, false);
  assert.equal(seo.analyze(target)[1].outcome, 'pass');
  assert.equal(seo.analyze(target)[2].outcome, 'review');
});

test('multiple raw header fields preserve unscoped directives and restrictive rules', () => {
  const target = page('<meta name="robots" content="all">', { 'x-robots-tag': 'otherbot: noindex, none' }, 200,
    ['X-Robots-Tag', 'otherbot: noindex', 'X-Robots-Tag', 'none']);
  const result = directives.read(target);
  assert.equal(result.noindex, true);
  assert.equal(result.nofollow, true);
  assert.equal(result.applicable.find((entry) => entry.evidence.kind === 'header').evidence.source, 'none');
});

test('spaced directive parameters are not treated as standalone none directives', () => {
  const target = page('<meta name="robots" content="max-image-preview: none, max-video-preview: 0">',
    { 'x-robots-tag': 'googlebot: max-image-preview: none, max-snippet: 0' });
  assert.equal(directives.read(target).noindex, false);
  assert.equal(directives.read(target).nofollow, false);
  assert.equal(seo.analyze(target)[1].outcome, 'pass');
});

test('expiration directives need review, not an invented current index status', () => {
  const target = page('', { 'x-robots-tag': 'unavailable_after: Wed, 25 Jun 2030 15:00:00 GMT, noimageindex' });
  assert.equal(directives.read(target).noindex, false);
  assert.equal(directives.read(target).hasExpiration, true);
  assert.equal(seo.analyze(target)[1].outcome, 'review');
});

test('truncated meta cannot produce a fully checked pass', () => {
  const target = page('<meta name="unrelated" content="x">'.repeat(5001) + '<meta name="robots" content="noindex">');
  assert.equal(seo.analyze(target)[1].outcome, 'not-checked');
});

test('service publishes real checks and issue counters without requiring every page to index', async (t) => {
  t.mock.method(website, 'fetchRobots', async () => { throw new website.WebsiteError('DNS_FAILED'); });
  t.mock.method(website, 'fetchPage', async () => ({ ...page('<meta name="robots" content="noindex">', {}, 404), requestedUrl: 'https://site.example/page' }));
  const result = await audit.create({ url: 'https://site.example/page' });
  assert.equal(result.ok, true);
  assert.equal(result.data.summary.critical, 1);
  assert.equal(result.data.summary.review, 2);
  assert.equal(result.data.summary.affected, 1);
  assert.equal(result.data.issues.length, 5);
  assert.equal(result.data.coverage.analyzed, 1);
  assert.equal(result.data.status, 'partial');
});
