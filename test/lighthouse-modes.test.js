const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../app/service/lighthouse.service');
const results = require('../app/service/lighthouse-result.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');
const { base, lhr, stubLighthouse } = require('./helpers/lighthouse');
const format = (source, strategy) => results.format({ status: 'received', data: { lighthouseResult: source } }, base, { strategy });

test('desktop/mobile retain source URLs, time, engine and mode instead of checker browser metadata', () => {
  const desktop = format(lhr({ configSettings: { formFactor: 'desktop', throttlingMethod: 'provided' } }), 'desktop');
  const mobile = format(lhr(), 'mobile');
  assert.equal(desktop.provider, 'lighthouse-local');
  assert.equal(desktop.status, 'completed');
  assert.equal(desktop.mode.formFactor, 'desktop');
  assert.equal(desktop.mode.throttlingMethod, 'provided');
  assert.equal(desktop.fetchTime, '2026-10-06T01:00:00.000Z');
  assert.equal(desktop.finalUrl, base + 'final');
  assert.equal(desktop.engine.version, '13.4.0');
  assert.equal(mobile.mode.formFactor, 'mobile');
});

test('invalid client strategy opens no socket, conflicting mode refuses scores and missing metadata remains missing', async (t) => {
  const transport = stubTransport(t, []);
  for (const strategy of ['tablet', '', null, {}, ['desktop']]) assert.equal((await service.run(base, { strategy })).reason, 'LIGHTHOUSE_INVALID_STRATEGY');
  assert.equal(transport.calls.length, 0);
  assert.equal(format(lhr(), 'desktop').reason, 'LIGHTHOUSE_MODE_MISMATCH');
  const result = format(lhr({ fetchTime: 'not-a-date', lighthouseVersion: undefined, userAgent: undefined, configSettings: undefined }));
  assert.equal(result.fetchTime, undefined);
  assert.equal(result.engine.version, undefined);
  assert.equal(result.mode.formFactor, undefined);
});

test('normalization rejects malformed documents and unmatched URLs instead of exposing raw provider data', () => {
  for (const source of [null, 'PRIVATE_RAW_ERROR', [], {}, lhr({ requestedUrl: base + 'other' }),
    lhr({ finalUrl: 'file:///secret' }), lhr({ finalUrl: 'https://user:secret@site.example/' })]) {
    const report = format(source);
    assert.equal(report.reason, 'LIGHTHOUSE_INVALID_RESPONSE');
    assert.deepEqual(report.categories, []);
    assert.ok(!JSON.stringify(report).includes('PRIVATE_RAW_ERROR'));
  }
  const runtime = format(lhr({ runtimeError: { code: 'FAILED', message: 'PRIVATE_RAW_ERROR' } }));
  assert.equal(runtime.reason, 'LIGHTHOUSE_RUNTIME');
  assert.deepEqual(runtime.categories, []);
  assert.ok(!JSON.stringify(runtime).includes('PRIVATE_RAW_ERROR'));
});

test('scores accept only finite numeric values in zero-to-one range and never coerce missing or invalid values', () => {
  for (const score of [-1, 1.01, Infinity, NaN, null, undefined, '1', {}, []]) {
    const report = format(lhr({ categories: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map(id => [id, { score }])) }));
    assert.equal(report.status, 'partial');
    assert.ok(report.categories.every(category => category.score === null && category.displayScore === undefined && category.status === 'not-checked'));
  }
  for (const score of [0, 0.724, 1]) {
    const report = format(lhr({ categories: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map(id => [id, { score }])) }));
    assert.equal(report.status, 'completed');
    assert.ok(report.categories.every(category => category.score === score && category.displayScore === Math.round(score * 100)));
  }
});

test('device controls post the chosen mode, metadata is escaped on mobile/desktop and refresh resets source metadata', async (t) => {
  const agent = '<img src=x onerror=globalThis.__scoreXss=true>';
  const engine = stubLighthouse(t, [lhr({ userAgent: agent, configSettings: { formFactor: 'desktop', throttlingMethod: 'provided' } })]);
  stubTransport(t, [{ html: good }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await page.locator('#lighthouse-enabled').check();
  await page.locator('label[for="strategy-desktop"]').click();
  await scan(page, base, { lighthouse: true });
  assert.equal(engine.calls[0].strategy, 'desktop');
  await page.locator('[data-bs-target="#lighthouse-scores"]').click();
  await page.waitForFunction(() => document.getElementById('lighthouse-scores').classList.contains('show'));
  const metadata = page.locator('#lighthouse-metadata');
  assert.ok((await metadata.textContent()).includes(agent));
  assert.ok((await metadata.textContent()).includes('13.4.0'));
  assert.equal(await metadata.locator('img,script,iframe').count(), 0);
  assert.equal(await page.evaluate(() => globalThis.__scoreXss), undefined);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 844 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.reload();
  assert.equal(await page.locator('#strategy-mobile').isChecked(), true);
  assert.equal(await page.locator('#lighthouse-enabled').isChecked(), true);
  assert.equal(await metadata.textContent(), '');
  assert.equal(await page.locator('#lighthouse-options').isVisible(), true);
  assert.deepEqual(errors, []);
});
