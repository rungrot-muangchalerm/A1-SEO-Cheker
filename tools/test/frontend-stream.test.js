const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, report } = require('./helpers/frontend');

const progress = { origin: 'https://site.example', currentUrl: 'https://site.example/child',
  discovered: 2, fetched: 1, analyzed: 1, skipped: 0, skippedEntries: [] };

test('browser displays live actual counts while the report/export remains unavailable, then displays the completed round', async (t) => {
  stubTransport(t, [{ status: 404 }, { html: '<title>Root</title><a href="/child">Child</a>' },
    { status: 404 }, { html: '<title>Child</title>', delay: 1200 }]);
  const { page, errors } = await frontend(t);
  await page.locator('#crawl-pages').check();
  await page.locator('#website-url').fill('https://site.example/');
  await page.locator('#scan-button').click();
  await page.locator('#crawl-progress').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#progress-counts').textContent()).includes('1'));
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  await page.waitForFunction(() => document.querySelector('#progress-url').textContent.includes('/child'));
  assert.ok((await page.locator('#progress-counts').textContent()).includes('2 URL'));
  await page.waitForFunction(() => document.querySelector('#report').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator('#summary-pages').textContent(), '2');
  assert.equal(await page.locator('#crawl-progress').isVisible(), false);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(await page.locator('#progress-counts').textContent(), '');
  assert.equal(await page.locator('#progress-url').textContent(), '');
  assert.deepEqual(errors, []);
});

test('NDJSON decoder preserves Thai across byte boundaries and clears malformed/incomplete streams instead of publishing them', async (t) => {
  const { page, errors } = await frontend(t);
  const data = report('https://site.example/', '<title>\u0e17\u0e14\u0e2a\u0e2d\u0e1a</title>');
  const valid = JSON.stringify({ type: 'progress', data: progress }) + '\n' + JSON.stringify({ type: 'report', data }) + '\n';
  for (const [body, success] of [[valid, true], [JSON.stringify({ type: 'progress', data: progress }) + '\n', false],
    [valid + JSON.stringify({ type: 'report', data }) + '\n', false], ['{"type":"unknown","data":{}}\n', false]]) {
    await page.evaluate((text) => {
      window.fetch = () => Promise.resolve(new Response(new ReadableStream({ start(stream) {
        const bytes = new TextEncoder().encode(text);
        for (let i = 0; i < bytes.length; i += 7) stream.enqueue(bytes.slice(i, i + 7));
        stream.close();
      } }), { headers: { 'Content-Type': 'application/x-ndjson' } }));
    }, body);
    await scan(page, 'https://site.example/');
    assert.equal(await page.locator('#report').isVisible(), success);
    if (success) assert.ok((await page.locator('#page-rows').textContent()).includes('\u0e17\u0e14\u0e2a\u0e2d\u0e1a'));
    else {
      assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
      assert.equal(await page.locator('#progress-counts').textContent(), '');
      assert.equal(await page.locator('#export-button').isDisabled(), true);
    }
  }
  assert.deepEqual(errors, []);
});

test('an error after live progress clears the partial UI and never substitutes a final mock report', async (t) => {
  t.mock.method(audit, 'create', async (_body, options) => {
    await options.onProgress(progress);
    return { ok: false, code: 'INTERNAL_ERROR' };
  });
  const { page, errors } = await frontend(t);
  await page.locator('#crawl-pages').check();
  await scan(page, 'https://site.example/');
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#crawl-progress').isVisible(), false);
  assert.equal(await page.locator('#page-rows').textContent(), '');
  assert.deepEqual(errors, []);
});
