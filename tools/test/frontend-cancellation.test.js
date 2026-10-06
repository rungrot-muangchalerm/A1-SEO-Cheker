const test = require('node:test');
const assert = require('node:assert/strict');
const website = require('../../app/data/website.data');
const { frontend, scan, report, bad } = require('./helpers/frontend');

function latch() {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  return { wait, release };
}

function slowBackend(t) {
  const started = latch();
  const cancelled = latch();
  let signal;
  t.mock.method(website, 'fetchPage', (url, options) => {
    if (!url.includes('/slow')) return Promise.resolve(report(url, bad).pages[0]);
    signal = options.signal;
    started.release();
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        cancelled.release();
        reject(new website.WebsiteError('CANCELLED'));
      }, { once: true });
    });
  });
  t.mock.method(website, 'fetchRobots', async (url) => ({ finalUrl: url, status: 404, redirects: [], bytes: 0 }));
  return { started: started.wait, cancelled: cancelled.wait, signal: () => signal };
}

async function startSlow(page) {
  await page.locator('#website-url').fill('https://fixture.example/slow');
  await page.locator('#scan-button').click();
}

test('starting a replacement round aborts the real browser HTTP request and its backend work', { timeout: 20000 }, async (t) => {
  const slow = slowBackend(t);
  const { page, errors } = await frontend(t);
  await startSlow(page);
  await slow.started;
  assert.equal(await page.locator('#cancel-button').isVisible(), true);
  await scan(page, 'https://fixture.example/current');
  await slow.cancelled;
  assert.equal(slow.signal().aborted, true);
  assert.equal(await page.locator('#report-host').textContent(), 'https://fixture.example/current');
  assert.equal(await page.locator('#cancel-button').isVisible(), false);
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'partial');
  assert.deepEqual(errors, []);
});

test('manual cancellation stops backend work without displaying a failed or invented report', { timeout: 20000 }, async (t) => {
  const slow = slowBackend(t);
  const { page, errors } = await frontend(t, { width: 390, height: 844 });
  await startSlow(page);
  await slow.started;
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#cancel-button').click();
  await slow.cancelled;
  await page.waitForFunction(() => document.getElementById('report').getAttribute('aria-busy') === 'false');
  assert.equal(slow.signal().aborted, true);
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'cancelled');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  assert.equal(await page.locator('#cancel-button').isVisible(), false);
  await scan(page, 'https://fixture.example/next');
  assert.equal(await page.locator('#report').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('refresh cancels in-flight work and clears URL, filters, rows and report', { timeout: 20000 }, async (t) => {
  const slow = slowBackend(t);
  const { page, errors } = await frontend(t);
  await scan(page, 'https://fixture.example/first');
  await page.locator('#severity-filter').selectOption('warning');
  await page.locator('[data-issue-id="image-alt"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  await page.locator('#issue-drawer [data-bs-dismiss="offcanvas"]').click();
  await page.locator('#issue-drawer.show').waitFor({ state: 'hidden' });
  await startSlow(page);
  await slow.started;
  await page.reload();
  await slow.cancelled;
  await page.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(slow.signal().aborted, true);
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.equal(await page.locator('#severity-filter').inputValue(), 'all');
  assert.equal(await page.locator('#scan-status').textContent(), '');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#issue-rows tr').count(), 0);
  assert.equal(await page.locator('#page-rows tr').count(), 0);
  assert.equal(await page.locator('#detail-content').textContent(), '');
  assert.equal(await page.locator('#cancel-button').isVisible(), false);
  assert.deepEqual(errors, []);
});

test('loading and cancellation controls fit mobile, tablet and desktop widths', { timeout: 20000 }, async (t) => {
  const slow = slowBackend(t);
  const { page, errors } = await frontend(t);
  await startSlow(page);
  await slow.started;
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => {
      const scan = document.getElementById('scan-button').getBoundingClientRect();
      const cancel = document.getElementById('cancel-button').getBoundingClientRect();
      const parent = document.getElementById('scan-button').parentElement.getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && scan.right <= cancel.left && cancel.right <= parent.right;
    }), true, `controls overflow at ${width}px`);
  }
  await page.locator('#cancel-button').click();
  await slow.cancelled;
  assert.deepEqual(errors, []);
});

test('closing the checker tab aborts active backend work and frees admission for subsequent requests', { timeout: 20000 }, async t => {
  const slow = slowBackend(t);
  const { page, origin, errors } = await frontend(t);
  await startSlow(page);
  await slow.started;
  await page.close();
  await slow.cancelled;
  assert.equal(slow.signal().aborted, true);
  const response = await fetch(origin + '/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://fixture.example/after-close', discover: false, crawl: false, render: false, lighthouse: false }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).requestedUrl, 'https://fixture.example/after-close');
  assert.deepEqual(errors, []);
});
