const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const timers = require('node:timers/promises');
require('./helpers/small-crawl-budgets').configure();
const audit = require('../../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, report } = require('./helpers/frontend');

async function childStarted(transport) {
  const deadline = Date.now() + 5000;
  while (transport.calls.length < 4) {
    assert.ok(Date.now() < deadline);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('manual cancel, refresh and replacing a live crawl stop backend work and clear progress without recovery', async (t) => {
  const { page, errors } = await frontend(t);
  for (const action of ['cancel', 'refresh', 'replace']) {
    t.mock.restoreAll();
    const transport = stubTransport(t, [{ status: 404 }, { html: '<title>First</title><a href="/child">Child</a>' },
      { status: 404 }, { neverRespond: true }, { status: 404 }, { html: '<title>Replacement</title>' }, { status: 404 }]);
    await page.locator('#crawl-pages').check();
    await page.locator('#website-url').fill('https://site.example/');
    await page.locator('#scan-button').click();
    await childStarted(transport);
    assert.equal(await page.locator('#crawl-progress').isVisible(), true);
    if (action === 'cancel') {
      await page.locator('#cancel-button').click();
      await page.waitForFunction(() => document.querySelector('#scan-status').dataset.state === 'cancelled');
      assert.equal(await page.locator('#report').isVisible(), false);
    } else if (action === 'refresh') {
      await page.reload();
      await page.waitForFunction(() => document.querySelector('header svg'));
      assert.equal(await page.locator('#website-url').inputValue(), '');
      assert.equal(await page.locator('#report').isVisible(), false);
    } else {
      await scan(page, 'https://site.example/second');
      assert.equal(await page.locator('#summary-pages').textContent(), '1');
      assert.equal(await page.locator('#report-host').textContent(), 'https://site.example/second');
      assert.ok((await page.locator('#page-rows').textContent()).includes('Replacement'));
      assert.ok(!(await page.locator('#page-rows').textContent()).includes('First'));
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(transport.connections[3].destroyed, true);
    assert.equal(await page.locator('#crawl-progress').isVisible(), false);
    if (action !== 'replace') {
      assert.equal(await page.locator('#progress-counts').textContent(), '');
      assert.equal(await page.locator('#export-button').isDisabled(), true);
    }
  }
  assert.deepEqual(errors, []);
});

test('page-limit notice reports the actual bound/count and skipped reasons, fits both viewports and clears on refresh', async (t) => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
  stubTransport(t, [{ status: 404 }, { html: '<title>Root</title>' + Array.from({ length: 22 }, (_, i) => '<a href="/p-' + i + '">P</a>').join('') },
    { status: 404 }, ...Array.from({ length: 22 }, (_, i) => ({ html: '<title>Page ' + i + '</title>' }))]);
  const data = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  assert.equal(data.crawl.stopReason, 'CRAWL_PAGE_LIMIT');
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', (route) => route.fulfill({ json: data }));
  await page.locator('#crawl-pages').check();
  await scan(page, 'https://site.example/');
  assert.equal(await page.locator('#crawl-limit').isVisible(), true);
  const notice = await page.locator('#crawl-limit').textContent();
  assert.ok(notice.includes('20 URL'));
  assert.ok(notice.includes('\u0e2d\u0e48\u0e32\u0e19\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 20'));
  assert.ok(notice.includes('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a'));
  await page.locator('#skipped-section summary').click();
  assert.ok((await page.locator('#skipped-list').textContent()).includes('CRAWL_PAGE_LIMIT'));
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SEO_SCREENSHOTS === 'true') {
      // These preview files contain only synthetic fixture data, never a live site's report.
      await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-crawl-limit-' + name + '.png'), fullPage: false });
    }
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(await page.locator('#crawl-limit').isVisible(), false);
  assert.equal(await page.locator('#crawl-limit').textContent(), '');
  assert.deepEqual(errors, []);
});

test('late progress and terminal frames cannot overwrite a newer round even if cancellation is ignored', async (t) => {
  const { page, errors } = await frontend(t);
  const first = report('https://first.example/');
  const second = report('https://second.example/');
  await page.evaluate(() => {
    window.testStreams = [];
    window.fetch = () => Promise.resolve(new Response(new ReadableStream({ start(stream) { window.testStreams.push(stream); } }),
      { headers: { 'Content-Type': 'application/x-ndjson' } }));
  });
  await page.locator('#crawl-pages').check();
  await page.locator('#website-url').fill(first.requestedUrl);
  await page.locator('#scan-button').click();
  await page.waitForFunction(() => window.testStreams.length === 1);
  await page.locator('#website-url').fill(second.requestedUrl);
  await page.locator('#scan-button').click();
  await page.waitForFunction(() => window.testStreams.length === 2);
  await page.evaluate(({ first, second }) => {
    const send = (index, type, data) => window.testStreams[index].enqueue(new TextEncoder().encode(JSON.stringify({ type, data }) + '\n'));
    const counts = { discovered: 1, fetched: 1, analyzed: 1, skipped: 0, skippedEntries: [] };
    send(1, 'progress', { ...counts, origin: second.scope.origin, currentUrl: second.requestedUrl });
    send(0, 'progress', { ...counts, discovered: 999, origin: first.scope.origin, currentUrl: first.requestedUrl });
    send(0, 'report', first);
    window.testStreams[0].close();
  }, { first, second });
  await page.waitForFunction(() => document.querySelector('#progress-url').textContent === 'https://second.example/');
  assert.ok(!(await page.locator('#progress-counts').textContent()).includes('999'));
  assert.equal(await page.locator('#report').isVisible(), false);
  await page.evaluate((data) => {
    window.testStreams[1].enqueue(new TextEncoder().encode(JSON.stringify({ type: 'report', data }) + '\n'));
    window.testStreams[1].close();
  }, second);
  await page.waitForFunction(() => document.querySelector('#report').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator('#report-host').textContent(), second.requestedUrl);
  assert.equal(await page.locator('#summary-pages').textContent(), '1');
  assert.deepEqual(errors, []);
});
