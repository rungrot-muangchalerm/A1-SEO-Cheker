const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const website = require('../../app/data/website.data');
const { frontend, scan, good, setAuditOptions } = require('./helpers/frontend');
const { stubTransport } = require('./helpers/transport');
const { base, lhr, stubLighthouse } = require('./helpers/lighthouse');

test('real transport failures replace earlier success honestly and keep desktop/mobile controls usable', async t => {
  stubLighthouse(t, [lhr(), { status: 'not-checked', reason: 'LIGHTHOUSE_REQUEST_LIMIT' }]);
  const transport = stubTransport(t, [{ html: good }, { status: 404 },
    { neverRespond: true }, { status: 302, headers: { location: '/again' } }, { status: 302, headers: { location: '/loop' } },
    { html: good }, { status: 404 }, { html: '<urlset><url></urlset>', headers: { 'content-type': 'application/xml' } },
    { html: good }, { status: 404 }]);
  const fetchPage = website.fetchPage;
  // Shorten only the fixture deadline, retaining the native DNS/transport/abort path.
  t.mock.method(website, 'fetchPage', (url, options) => fetchPage(url, { ...options, ...(url.endsWith('/slow') ? { timeoutMs: 60 } : {}) }));
  const { page, errors } = await frontend(t);
  await scan(page, base, { lighthouse: true });
  assert.equal(await page.locator('#lighthouse-categories [data-score-value]').count(), 4);
  for (const path of ['slow', 'loop']) {
    await scan(page, base + path);
    assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
    assert.equal(await page.locator('#report').isVisible(), false);
    assert.equal(await page.locator('#lighthouse-categories [data-score-value]').count(), 0);
    assert.equal(await page.locator('#export-json-button').isDisabled(), true);
    assert.equal(await page.locator('#scan-spinner').isVisible(), false);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#scan-button').isEnabled(), true);
    }
  }
  assert.equal(transport.connections[2].destroyed, true);
  setAuditOptions(page, { discover: true });
  await scan(page, base + 'maps');
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'partial');
  assert.equal(await page.locator('#summary-pages').textContent(), '1');
  assert.ok((await page.locator('#not-checked-list').textContent()).includes('SITEMAP_INVALID_XML'));
  setAuditOptions(page, { discover: false });
  await scan(page, base, { lighthouse: true });
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'partial');
  assert.equal(await page.locator('#report').isVisible(), true);
  assert.equal(await page.locator('#export-json-button').isDisabled(), false);
  assert.equal(await page.locator('#lighthouse-categories [data-score-value]').count(), 0);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('LIGHTHOUSE_REQUEST_LIMIT'));
  assert.equal(transport.calls.length, 10);
  assert.equal(await page.locator('#lighthouse-scores').isVisible(), true);
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok(!(await page.locator('body').textContent()).includes('PRIVATE_PROVIDER_FAILURE'));
    await page.evaluate(() => scrollTo(0, 0));
    if (process.env.SEO_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-final-' + name + '.png'), fullPage: true });
  }
  assert.deepEqual(errors, []);
});
