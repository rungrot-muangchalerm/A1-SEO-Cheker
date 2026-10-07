const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../../app/service/html.service');
const seo = require('../../app/service/seo.service');
const model = require('../../app/model/audit.model');

function report(source, robots = { status: 'absent', httpStatus: 404, googlebotAllowed: true }, status = 200) {
  const page = { requestedUrl: 'https://site.example/', finalUrl: 'https://site.example/', html: source, headers: {}, status, redirects: [], robots };
  page.metadata = html.parse(page);
  page.checks = seo.analyze(page);
  return model.createReport(page, new Date().toISOString());
}

const valid = '<title>Useful page</title><meta name="description" content="Useful description"><link rel="canonical" href="https://site.example/">' +
  '<meta property="og:title" content="Useful page"><meta property="og:type" content="website"><meta property="og:image" content="https://site.example/image.jpg">' +
  '<meta property="og:url" content="https://site.example/"><meta property="og:description" content="Useful share description"><img src="x" alt="">';

test('all initial-page rules can pass without claiming rendered, Lighthouse or site-wide coverage', () => {
  const result = report(valid);
  assert.deepEqual(result.issues, []);
  assert.equal(result.pages[0].analysisStatus, 'complete');
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.summary.checks, { pass: 9, fail: 0, review: 0, notChecked: 0 });
  assert.deepEqual(result.notChecked.map((entry) => entry.id), ['javascript-render', 'lighthouse', 'site-crawl', 'canonical-target']);
  assert.equal(result.scope.maxPages, 1);
  assert.equal(result.lighthouse.status, 'not-checked');
});

test('failed, review and unavailable outcomes are separate and counters match actual issues', () => {
  const result = report('', { status: 'not-checked', reason: 'TIMEOUT' }, 404);
  assert.equal(result.pages[0].analysisStatus, 'partial');
  assert.deepEqual(result.summary.checks, { pass: 3, fail: 3, review: 1, notChecked: 2 });
  assert.equal(result.issues.length, 4);
  assert.equal(result.summary.critical, 1);
  assert.equal(result.summary.warning, 2);
  assert.equal(result.summary.review, 1);
  assert.equal(result.notChecked[0].id, 'robots-crawling');
  assert.equal(result.notChecked[0].reason, 'TIMEOUT');
  assert.ok(result.issues.every((entry) => ['fail', 'review'].includes(entry.outcome)));
});

test('a proven issue may still have incomplete coverage and must disclose both facts', () => {
  const result = report(valid + '<img src="missing">' + '<img src="x" alt="">'.repeat(5001));
  const issue = result.issues.find((entry) => entry.ruleId === 'image-alt');
  assert.equal(issue.outcome, 'fail');
  assert.equal(issue.complete, false);
  assert.equal(result.pages[0].analysisStatus, 'partial');
  assert.ok(result.notChecked.some((entry) => entry.id === 'image-alt' && entry.reason === 'element-limit'));
});

test('robots absence is not a failure and intentional indexing restriction is review', () => {
  const result = report(valid + '<meta name="robots" content="noindex">');
  assert.equal(result.pages[0].checks.find((entry) => entry.ruleId === 'robots-crawling').outcome, 'pass');
  assert.equal(result.issues.find((entry) => entry.ruleId === 'robots-indexing').outcome, 'review');
  assert.equal(result.summary.critical, 0);
});
