const test = require('node:test');
const assert = require('node:assert/strict');
const agentic = require('../app/service/agentic.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');
const { base, lhr, jsonResponse, key } = require('./helpers/pagespeed');
const source = () => {
  const result = lhr();
  result.categories['agentic-browsing'] = { categoryScoreDisplayMode: 'fraction', score: 1,
    auditRefs: ['pass', 'fail', 'numeric', 'error', 'info', 'manual', 'na', 'hidden'].map((id) => ({ id, weight: 1, ...(id === 'hidden' ? { group: 'hidden' } : {}) })) };
  result.audits = Object.fromEntries([['pass', 'binary', 1], ['fail', 'binary', 0], ['numeric', 'numeric', 0.95], ['error', 'error', null],
    ['info', 'informative', null], ['manual', 'manual', null], ['na', 'notApplicable', null], ['hidden', 'binary', 1]].map(([id, scoreDisplayMode, score]) => [id, { scoreDisplayMode, score }]));
  return result;
};

test('agentic requires actual provider engine version and category format, not the checker browser or four-category scores', () => {
  assert.equal(agentic.analyze(lhr()).reason, 'not-returned-by-provider');
  assert.equal(agentic.analyze(source()).status, 'completed');
  assert.equal(agentic.analyze({ ...source(), userAgent: 'Chrome/149.0.0.0' }).reason, 'engine-not-supported');
  assert.equal(agentic.analyze({ ...source(), userAgent: undefined }).reason, 'engine-version-unavailable');
  const unknown = source();
  delete unknown.categories['agentic-browsing'].categoryScoreDisplayMode;
  assert.equal(agentic.analyze(unknown).reason, 'unsupported-result-format');
});

test('fraction counts actual passable refs once, includes errors, excludes manual/N/A/hidden and keeps informational counts separate', () => {
  const result = agentic.analyze(source());
  assert.equal(result.passed, 2);
  assert.equal(result.total, 4);
  assert.equal(result.informational, 1);
  assert.equal(result.excluded, 3);
  assert.equal(result.score, undefined);
  assert.equal(result.displayScore, undefined);
  for (const mutate of [s => delete s.audits.fail, s => s.categories['agentic-browsing'].auditRefs.push({ id: 'pass' }),
    s => s.audits.pass.score = null, s => s.categories['agentic-browsing'].auditRefs = Array(501).fill({ id: 'pass' })]) {
    const current = source(); mutate(current);
    assert.equal(agentic.analyze(current).reason, 'incomplete-audit-evidence');
  }
});

test('no applicable refs is unavailable, not an invented 0/0 or 100', () => {
  const current = source();
  current.categories['agentic-browsing'].auditRefs = [{ id: 'na' }];
  const result = agentic.analyze(current);
  assert.equal(result.status, 'not-checked');
  assert.equal(result.reason, 'no-applicable-audits');
});

test('actual API/UI displays only a supported source fraction; next provider without category clears it, and F5 clears results', async (t) => {
  key(t);
  stubTransport(t, [{ html: good }, { status: 404 }, jsonResponse(source()), { html: good }, { status: 404 }, jsonResponse()]);
  const { page, errors } = await frontend(t);
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  assert.ok((await page.locator('#agentic-status').textContent()).includes('2/4'));
  assert.equal(await page.locator('[data-score-category="agentic-browsing"]').count(), 0);
  await scan(page, base);
  assert.ok((await page.locator('#agentic-status').textContent()).includes('not-returned-by-provider'));
  assert.ok(!(await page.locator('#agentic-status').textContent()).includes('2/4'));
  await page.reload();
  assert.equal(await page.locator('#agentic-status').textContent(), '');
  assert.deepEqual(errors, []);
});
