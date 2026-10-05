const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../app/service/pagespeed.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');
const { base, lhr, jsonResponse, key } = require('./helpers/pagespeed');

test('desktop/mobiles send distinct strategies and keep provider URLs, source time, engine and mode instead of checker browser metadata', async (t) => {
  key(t);
  const transport = stubTransport(t, [jsonResponse(lhr({ configSettings: { formFactor: 'desktop', throttlingMethod: 'provided' } })), jsonResponse()]);
  const desktop = await service.run(base, { strategy: 'desktop' });
  const mobile = await service.run(base, { strategy: 'mobile' });
  assert.equal(desktop.status, 'completed');
  assert.equal(desktop.mode.formFactor, 'desktop');
  assert.equal(desktop.mode.throttlingMethod, 'provided');
  assert.equal(desktop.fetchTime, '2026-10-06T01:00:00.000Z');
  assert.equal(desktop.finalUrl, base + 'final');
  assert.equal(desktop.engine.version, '13.4.0');
  assert.equal(mobile.mode.formFactor, 'mobile');
  assert.deepEqual(transport.calls.map((entry) => new URL(entry.url).searchParams.get('strategy')), ['desktop', 'mobile']);
});

test('invalid client strategy opens no provider socket, conflicting mode refuses scores and missing metadata remains missing', async (t) => {
  key(t);
  const transport = stubTransport(t, [jsonResponse(), jsonResponse(lhr({ fetchTime: 'not-a-date', lighthouseVersion: undefined, userAgent: undefined, configSettings: undefined }))]);
  for (const strategy of ['tablet', '', null, {}, ['desktop']]) assert.equal((await service.run(base, { strategy })).reason, 'PAGESPEED_INVALID_STRATEGY');
  assert.equal(transport.calls.length, 0);
  assert.equal((await service.run(base, { strategy: 'desktop' })).reason, 'PAGESPEED_MODE_MISMATCH');
  const result = await service.run(base);
  assert.equal(result.fetchTime, undefined);
  assert.equal(result.engine.version, undefined);
  assert.equal(result.mode.formFactor, undefined);
});

test('device controls post the chosen mode, metadata is escaped on mobile/desktop and refresh removes source metadata', async (t) => {
  key(t);
  const agent = '<img src=x onerror=globalThis.__scoreXss=true>';
  const transport = stubTransport(t, [{ html: good }, { status: 404 }, jsonResponse(lhr({ userAgent: agent,
    configSettings: { formFactor: 'desktop', throttlingMethod: 'provided' } }))]);
  const { page, errors } = await frontend(t);
  assert.equal(await page.locator('#pagespeed-options').isVisible(), false);
  await page.locator('#pagespeed-enabled').check();
  await page.locator('label[for="strategy-desktop"]').click();
  await scan(page, base);
  assert.equal(new URL(transport.calls.at(-1).url).searchParams.get('strategy'), 'desktop');
  await page.locator('[data-bs-target="#lighthouse-scores"]').click();
  await page.waitForFunction(() => document.getElementById('lighthouse-scores').classList.contains('show'));
  const metadata = page.locator('#lighthouse-metadata');
  assert.ok((await metadata.textContent()).includes(agent));
  assert.ok((await metadata.textContent()).includes('13.4.0'));
  assert.equal(await metadata.locator('img,script,iframe').count(), 0);
  assert.equal(await page.evaluate(() => globalThis.__scoreXss), undefined);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.reload();
  assert.equal(await page.locator('#strategy-mobile').isChecked(), true);
  assert.equal(await metadata.textContent(), '');
  assert.equal(await page.locator('#pagespeed-options').isVisible(), false);
  assert.deepEqual(errors, []);
});
