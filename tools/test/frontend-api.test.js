const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { frontend, scan, report } = require('./helpers/frontend');

test('URL form posts each current request, including its path and query, with no startup history fetch', async (t) => {
  const { page, errors } = await frontend(t);
  const requests = [];
  await page.route('**/api/audits', (route) => {
    const request = route.request();
    const input = request.postDataJSON();
    requests.push({ method: request.method(), input, headers: request.headers() });
    return route.fulfill({ json: report(input.url) });
  });
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(requests.length, 0);
  for (const url of ['https://first.example/a?version=2', 'https://second.example/another']) {
    await scan(page, url);
    assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'partial');
    assert.ok((await page.locator('#scan-status').textContent()).includes(url));
    assert.equal(await page.locator('#report-host').textContent(), url);
  }
  assert.deepEqual(requests.map(({ method, input }) => ({ method, input })), [
    { method: 'POST', input: { url: 'https://first.example/a?version=2', strategy: 'mobile' } },
    { method: 'POST', input: { url: 'https://second.example/another', strategy: 'mobile' } }
  ]);
  assert.ok(requests.every((request) => request.headers['content-type'] === 'application/json'));
  assert.ok(requests.every((request) => request.headers.accept === 'application/x-ndjson'));
  assert.equal(await page.locator('#scan-form input[type="checkbox"]').count(), 0);
  assert.deepEqual(errors, []);
});

test('request waits for API completion and a server error never opens the mockup', async (t) => {
  const { page, errors } = await frontend(t);
  let release;
  let started;
  const pending = new Promise((resolve) => { release = resolve; });
  const requested = new Promise((resolve) => { started = resolve; });
  await page.route('**/api/audits', async (route) => {
    started();
    await pending;
    return route.fulfill({ status: 504, json: { schemaVersion: '1.0', status: 'failed', error: 'TIMEOUT', message: 'Target timed out' } });
  });
  await page.locator('#website-url').fill('https://slow.example/');
  await page.locator('#scan-button').click();
  await requested;
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'loading');
  assert.equal(await page.locator('#report').getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  release();
  await page.waitForFunction(() => document.getElementById('scan-status').dataset.state === 'failed');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#scan-status').textContent(), 'Target timed out');
  assert.equal(await page.locator('#scan-button').isEnabled(), true);
  assert.deepEqual(errors, []);
});

test('unsupported URL protocols are rejected before contacting the audit API', async (t) => {
  const { page, errors } = await frontend(t);
  let requests = 0;
  await page.route('**/api/audits', (route) => { requests += 1; return route.abort(); });
  await page.locator('#website-url').fill('ftp://example.com/file');
  await page.locator('#scan-button').click();
  assert.equal(requests, 0);
  assert.equal(await page.locator('#website-url').evaluate((input) => input.validity.valid), false);
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.deepEqual(errors, []);
});

test('network, malformed JSON and malformed reports cannot restore mock issues or scores', async (t) => {
  const { page, errors } = await frontend(t);
  let mode = 'success';
  await page.route('**/api/audits', (route) => {
    if (mode === 'network') return route.abort('connectionfailed');
    if (mode === 'json') return route.fulfill({ contentType: 'text/html', body: '<html>Gateway error</html>' });
    if (mode === 'schema') return route.fulfill({ json: { schemaVersion: '1.0', status: 'partial', pages: [] } });
    return route.fulfill({ json: report(route.request().postDataJSON().url) });
  });
  await scan(page, 'https://first.example/');
  for (mode of ['network', 'json', 'schema']) {
    await scan(page, 'https://failed.example/' + mode);
    assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
    assert.equal(await page.locator('#report').isVisible(), false);
    assert.equal(await page.locator('#issue-rows tr').count(), 0);
    assert.equal(await page.locator('#page-rows tr').count(), 0);
    assert.equal(await page.locator('#lighthouse-categories').textContent(), '');
    assert.equal(await page.locator('#lighthouse-scores svg').count(), 0);
    assert.equal(await page.locator('#export-button').isDisabled(), true);
  }
  const app = fs.readFileSync(path.join(__dirname, '../../assets/js/app.js'), 'utf8');
  assert.equal(app.includes('Example Studio'), false);
  assert.equal(app.includes('/old-pricing'), false);
  assert.deepEqual(errors, []);
});
