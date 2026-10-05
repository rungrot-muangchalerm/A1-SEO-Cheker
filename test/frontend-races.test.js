const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report, good, bad } = require('./helpers/frontend');

function latch() {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  return { wait, release };
}

async function start(page, url) {
  await page.locator('#website-url').fill(url);
  await page.locator('#scan-button').click();
}

async function trackResponses(page) {
  await page.evaluate(() => {
    const original = window.fetch;
    globalThis.parsedResponses = 0;
    // Ignore cancellation deliberately: round guards must still reject late responses.
    window.fetch = (url, options) => original(url, { ...options, signal: undefined }).then((response) => {
      const json = response.json.bind(response);
      response.json = () => json().finally(() => { globalThis.parsedResponses++; });
      return response;
    });
  });
}

test('an older successful response cannot overwrite a newer report, even for the same URL', async (t) => {
  const { page, errors } = await frontend(t);
  await trackResponses(page);
  const old = latch();
  const requested = latch();
  let calls = 0;
  const url = 'https://fixture.example/same';
  await page.route('**/api/audits', async (route) => {
    calls++;
    if (calls === 1) {
      requested.release();
      await old.wait;
      return route.fulfill({ json: report(url, bad) });
    }
    return route.fulfill({ json: report(url, good) });
  });
  await start(page, url);
  await requested.wait;
  assert.equal(await page.locator('#scan-button').isEnabled(), true);
  await scan(page, url);
  assert.equal(await page.locator('#issue-rows tr').count(), 0);
  old.release();
  await page.waitForFunction(() => globalThis.parsedResponses === 2);
  assert.equal(await page.locator('#report-host').textContent(), url);
  assert.equal(await page.locator('#issue-rows tr').count(), 0);
  assert.equal(await page.locator('#summary-warning').textContent(), '0');
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'partial');
  assert.deepEqual(errors, []);
});

test('an obsolete server failure cannot hide the current report or replace its status', async (t) => {
  const { page, errors } = await frontend(t);
  await trackResponses(page);
  const old = latch();
  const requested = latch();
  await page.route('**/api/audits', async (route) => {
    const url = route.request().postDataJSON().url;
    if (url.includes('/old')) {
      requested.release();
      await old.wait;
      return route.fulfill({ status: 504, json: { status: 'failed', message: 'Obsolete timeout' } });
    }
    return route.fulfill({ json: report(url, bad) });
  });
  await start(page, 'https://fixture.example/old');
  await requested.wait;
  const url = 'https://fixture.example/current';
  await scan(page, url);
  const count = await page.locator('#issue-rows tr').count();
  old.release();
  await page.waitForFunction(() => globalThis.parsedResponses === 2);
  assert.equal(await page.locator('#report').isVisible(), true);
  assert.equal(await page.locator('#report-host').textContent(), url);
  assert.equal(await page.locator('#issue-rows tr').count(), count);
  assert.equal((await page.locator('#scan-status').textContent()).includes('Obsolete'), false);
  assert.deepEqual(errors, []);
});

test('the old request finally handler cannot stop a newer loading state', async (t) => {
  const { page, errors } = await frontend(t);
  await trackResponses(page);
  const old = latch();
  const current = latch();
  const requested = [latch(), latch()];
  await page.route('**/api/audits', async (route) => {
    const url = route.request().postDataJSON().url;
    const index = url.includes('/old') ? 0 : 1;
    requested[index].release();
    await (index === 0 ? old.wait : current.wait);
    return route.fulfill({ json: report(url) });
  });
  await start(page, 'https://fixture.example/old');
  await requested[0].wait;
  await start(page, 'https://fixture.example/current');
  await requested[1].wait;
  old.release();
  await page.waitForFunction(() => globalThis.parsedResponses === 1);
  assert.equal(await page.locator('#report').getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#scan-spinner').isVisible(), true);
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'loading');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  current.release();
  await page.waitForFunction(() => document.getElementById('report').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator('#report-host').textContent(), 'https://fixture.example/current');
  assert.deepEqual(errors, []);
});
