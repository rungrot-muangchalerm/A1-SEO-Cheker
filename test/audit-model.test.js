const test = require('node:test');
const assert = require('node:assert/strict');
const auditModel = require('../app/model/audit.model');
const auditService = require('../app/service/audit.service');
const websiteData = require('../app/data/website.data');

const page = {
  requestedUrl: 'https://old.example/', finalUrl: 'https://new.example/home', status: 200,
  headers: { 'content-type': 'text/html' }, html: '<title>Actual page</title>', bytes: 26, redirects: []
};

test('report distinguishes fetched evidence from analysis that was not performed', async (t) => {
  t.mock.method(websiteData, 'fetchRobots', async () => { throw new websiteData.WebsiteError('DNS_FAILED'); });
  t.mock.method(websiteData, 'fetchPage', async () => ({ ...page }));
  const result = await auditService.create({ url: page.requestedUrl });
  assert.equal(result.ok, true);
  const report = result.data;
  assert.equal(report.schemaVersion, auditModel.version);
  assert.equal(report.status, 'partial');
  assert.deepEqual(report.scope, { type: 'single-page', origin: 'https://new.example', maxPages: 1 });
  assert.deepEqual(report.coverage, { discovered: 1, fetched: 1, analyzed: 1, skipped: [], limitReached: false });
  assert.equal(report.pages.length, 1);
  assert.equal(report.pages[0].analysisStatus, 'partial');
  assert.equal(report.pages[0].checks.length, 8);
  assert.ok(report.pages[0].checks.slice(0, 3).every((entry) => entry.outcome === 'pass'));
  assert.equal(report.pages[0].html, page.html);
  assert.equal(report.notChecked[0].id, 'robots-crawling');
  assert.equal(report.notChecked[0].url, page.finalUrl);
  assert.equal(report.issues.length, 2);
  assert.equal(report.lighthouse.status, 'not-checked');
  assert.deepEqual(report.lighthouse.categories, []);
  assert.ok(Number.isFinite(Date.parse(report.startedAt)));
  assert.ok(Date.parse(report.completedAt) >= Date.parse(report.startedAt));
  assert.equal(report.auditId, undefined);
  assert.equal(report.history, undefined);
});

test('report arrays and counters do not retain state from previous rounds', () => {
  const first = auditModel.createReport(page, new Date().toISOString());
  first.coverage.analyzed = 99;
  first.issues.push({ id: 'old-result' });
  first.pages[0].checks.push({ id: 'old-rule' });
  const second = auditModel.createReport(page, new Date().toISOString());
  assert.equal(second.coverage.analyzed, 0);
  assert.deepEqual(second.issues, []);
  assert.deepEqual(second.pages[0].checks, []);
});
