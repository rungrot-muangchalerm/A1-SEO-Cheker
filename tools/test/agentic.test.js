const test = require('node:test');
const assert = require('node:assert/strict');
const agentic = require('../../app/service/agentic.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');
const { base, lhr, stubLighthouse } = require('./helpers/lighthouse');
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
  assert.equal(agentic.analyze(source()).status, 'partial');
  assert.equal(agentic.analyze({ ...source(), userAgent: 'Chrome/149.0.0.0' }).reason, 'engine-not-supported');
  assert.equal(agentic.analyze({ ...source(), userAgent: undefined }).reason, 'engine-version-unavailable');
  const unknown = source();
  delete unknown.categories['agentic-browsing'].categoryScoreDisplayMode;
  assert.equal(agentic.analyze(unknown).reason, 'unsupported-result-format');
});

test('fraction counts verified audits only, preserves engine fraction and separates runtime errors/manual/N/A/information', () => {
  const result = agentic.analyze(source());
  assert.equal(result.passed, 2);
  assert.equal(result.total, 3);
  assert.equal(result.failed, 1);
  assert.equal(result.notChecked, 1);
  assert.deepEqual(result.engineFraction, { passed: 2, total: 4 });
  assert.equal(result.audits.find(row => row.id === 'error').passed, null);
  assert.equal(result.audits.find(row => row.id === 'error').status, 'not-checked');
  assert.equal(result.informational, 1);
  assert.equal(result.excluded, 3);
  assert.equal(result.score, undefined);
  assert.equal(result.displayScore, undefined);
  for (const mutate of [s => s.categories['agentic-browsing'].auditRefs.push({ id: 'pass' }),
    s => s.categories['agentic-browsing'].auditRefs = Array(501).fill({ id: 'pass' })]) {
    const current = source(); mutate(current);
    assert.equal(agentic.analyze(current).reason, 'incomplete-audit-evidence');
  }
});

test('missing, malformed and policy-blocked audits are partial, not false failures; source errors are never exposed', () => {
  for (const mutate of [s => delete s.audits.fail, s => s.audits.fail.score = null, s => s.audits.fail.score = NaN,
    s => s.audits.fail.score = 2, s => s.audits.fail.scoreDisplayMode = 'unknown']) {
    const current = source(); mutate(current);
    const result = agentic.analyze(current);
    assert.equal(result.status, 'partial');
    assert.equal(result.total, 2);
    assert.equal(result.failed, 0);
    assert.equal(result.notChecked, 2);
    assert.equal(result.engineFraction, undefined);
  }
  const current = source();
  current.audits.error.errorMessage = 'PRIVATE_ERROR_MARKER';
  current.audits.error.explanation = 'PRIVATE_ERROR_MARKER';
  const result = agentic.analyze(current, { fail: 'ROBOTS_BLOCKED' });
  assert.equal(result.total, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.audits.find(row => row.id === 'fail').reason, 'ROBOTS_BLOCKED');
  assert.ok(!JSON.stringify(result).includes('PRIVATE_ERROR_MARKER'));
});

test('audit text and node evidence are allowlisted, bounded and expose truncation without retaining raw details', () => {
  const current = source();
  Object.assign(current.audits.fail, { title: 'x'.repeat(300), description: 'd'.repeat(3000),
    details: { type: 'list', items: [{ type: 'list-section', value: { type: 'table', items: Array.from({ length: 30 }, () => ({
      description: 'Name missing', node: { selector: '#empty', snippet: '<button></button>' }, secret: 'DO_NOT_KEEP'
    })) } }] } });
  const row = agentic.analyze(current).audits.find(row => row.id === 'fail');
  assert.equal(row.title.length, 256);
  assert.equal(row.description.length, 2048);
  assert.equal(row.evidence.length, 20);
  assert.equal(row.evidence[0].selector, '#empty');
  assert.equal(row.evidence[0].snippet, '<button></button>');
  assert.equal(row.truncated, true);
  assert.ok(!JSON.stringify(row).includes('DO_NOT_KEEP'));
  current.audits.fail.details = { type: 'table', items: [{ element: { type: 'node', selector: '#form', snippet: '<form></form>' }, issue: 'Missing tool name' }] };
  assert.deepEqual(agentic.analyze(current).audits.find(row => row.id === 'fail').evidence,
    [{ issue: 'Missing tool name', selector: '#form', snippet: '<form></form>' }]);
});

test('no applicable refs is unavailable, not an invented 0/0 or 100', () => {
  const current = source();
  current.categories['agentic-browsing'].auditRefs = [{ id: 'na' }];
  const result = agentic.analyze(current);
  assert.equal(result.status, 'not-checked');
  assert.equal(result.reason, 'no-applicable-audits');
});

test('actual API/UI displays only a supported source fraction; next provider without category clears it, and F5 clears results', async (t) => {
  stubLighthouse(t, [source(), lhr()]);
  stubTransport(t, [{ html: good }, { status: 404 }, { html: good }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await scan(page, base, { lighthouse: true });
  assert.ok((await page.locator('#agentic-status').textContent()).includes('2/3'));
  assert.equal(await page.locator('[data-agentic-audit]').count(), 7);
  assert.ok((await page.locator('[data-agentic-audit="error"]').textContent()).includes('audit-runtime-error'));
  assert.equal(await page.locator('[data-score-category="agentic-browsing"]').count(), 0);
  await scan(page, base, { lighthouse: true });
  assert.ok((await page.locator('#agentic-status').textContent()).includes('not-returned-by-provider'));
  assert.ok(!(await page.locator('#agentic-status').textContent()).includes('2/3'));
  assert.equal(await page.locator('[data-agentic-audit]').count(), 0);
  await page.reload();
  assert.equal(await page.locator('#agentic-status').textContent(), '');
  assert.deepEqual(errors, []);
});

test('Agentic titles and HTML snippets stay inert text and fit expanded details on mobile and desktop', async t => {
  const current = source();
  current.audits.fail.title = '<img src=x onerror="window.agenticInjection=true">';
  current.audits.fail.description = 'https://fixture.example/' + 'x'.repeat(2000);
  current.audits.fail.details = { type: 'table', items: [{ node: { selector: '#unsafe', snippet: '<script>window.agenticInjection=true</script>' } }] };
  stubLighthouse(t, [current]);
  stubTransport(t, [{ html: good }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await scan(page, base, { lighthouse: true });
  assert.equal(await page.locator('#lighthouse-scores').isVisible(), true);
  await page.locator('#lighthouse-metadata').evaluate(node => { node.closest('details').open = true; });
  await page.waitForFunction(() => document.getElementById('lighthouse-scores').classList.contains('show'));
  await page.locator('[data-agentic-audit="fail"] summary').click();
  assert.ok((await page.locator('[data-agentic-audit="fail"]').textContent()).includes('<script>'));
  assert.equal(await page.locator('#agentic-audits img, #agentic-audits script').count(), 0);
  assert.equal(await page.evaluate(() => window.agenticInjection), undefined);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.deepEqual(errors, []);
});
