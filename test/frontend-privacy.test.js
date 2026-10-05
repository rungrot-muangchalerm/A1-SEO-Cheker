const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report, bad } = require('./helpers/frontend');

async function assertEmpty(page) {
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('#report').getAttribute('aria-busy'), 'false');
  for (const id of ['issue-rows', 'page-rows', 'detail-content', 'not-checked-list', 'report-time', 'report-host', 'scan-status']) {
    assert.equal(await page.locator('#' + id).textContent(), '');
  }
  for (const id of ['severity-filter', 'category-filter', 'page-filter']) {
    assert.equal(await page.locator('#' + id).inputValue(), 'all');
  }
  assert.equal(await page.locator('#issue-search').inputValue(), '');
  assert.equal(await page.locator('#export-button').isDisabled(), true);
}

test('completed reports leave no browser storage, cookies, service workers or cache entries', async (t) => {
  const { page, context, errors } = await frontend(t);
  let requests = 0;
  await page.route('**/api/audits', (route) => {
    requests++;
    return route.fulfill({ json: report(route.request().postDataJSON().url, bad), headers: { 'Cache-Control': 'no-store' } });
  });
  await page.evaluate(() => {
    globalThis.persistenceAttempts = 0;
    Storage.prototype.setItem = () => { globalThis.persistenceAttempts++; throw new Error('Unexpected storage'); };
    indexedDB.open = () => { globalThis.persistenceAttempts++; throw new Error('Unexpected database'); };
    navigator.serviceWorker.register = () => { globalThis.persistenceAttempts++; throw new Error('Unexpected worker'); };
    caches.open = () => { globalThis.persistenceAttempts++; throw new Error('Unexpected cache'); };
  });
  await scan(page, 'https://fixture.example/one');
  await scan(page, 'https://fixture.example/two');
  assert.deepEqual(await page.evaluate(async () => ({
    attempts: globalThis.persistenceAttempts, local: localStorage.length, session: sessionStorage.length,
    databases: await indexedDB.databases(), workers: (await navigator.serviceWorker.getRegistrations()).length,
    caches: await caches.keys(), cookies: document.cookie
  })), { attempts: 0, local: 0, session: 0, databases: [], workers: 0, caches: [], cookies: '' });
  assert.deepEqual(await context.cookies(), []);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('header svg'));
  await assertEmpty(page);
  assert.equal(requests, 2);
  assert.deepEqual(errors, []);
});

test('pagehide and persisted pageshow clear report memory and all result DOM without a recovery request', async (t) => {
  const { page, errors } = await frontend(t);
  let requests = 0;
  await page.route('**/api/audits', (route) => {
    requests++;
    return route.fulfill({ json: report(route.request().postDataJSON().url, bad) });
  });
  await scan(page, 'https://fixture.example/one');
  await page.locator('#severity-filter').selectOption('warning');
  await page.locator('#issue-search').fill('alt');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await assertEmpty(page);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await assertEmpty(page);
  // Hidden controls cannot export an old report after the transition.
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('#export-button').evaluate((button) => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(downloads, 0);
  assert.equal(requests, 1);
  await scan(page, 'https://fixture.example/two');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await assertEmpty(page);
  assert.equal(requests, 2);
  assert.deepEqual(errors, []);
});

test('navigation away and browser Back never restore a previous report or URL', async (t) => {
  const { page, origin, errors } = await frontend(t);
  let requests = 0;
  await page.route('**/api/audits', (route) => {
    requests++;
    return route.fulfill({ json: report(route.request().postDataJSON().url, bad) });
  });
  await scan(page, 'https://fixture.example/previous');
  await page.goto(origin + '/missing-page');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('header svg'));
  await assertEmpty(page);
  assert.equal(requests, 1);
  assert.deepEqual(errors, []);
});

test('manual download object URLs are released and leaving the page revokes pending URLs', async (t) => {
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', (route) => route.fulfill({ json: report('https://fixture.example/bad', bad) }));
  await scan(page, 'https://fixture.example/bad');
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    globalThis.createdUrls = [];
    globalThis.revokedUrls = [];
    URL.createObjectURL = (blob) => { const url = create(blob); globalThis.createdUrls.push(url); return url; };
    URL.revokeObjectURL = (url) => { globalThis.revokedUrls.push(url); revoke(url); };
  });
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-button').click();
  await downloaded;
  await page.waitForFunction(() => globalThis.revokedUrls.includes(globalThis.createdUrls[0]));
  const next = page.waitForEvent('download');
  await page.locator('#export-button').click();
  await next;
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  assert.equal(await page.evaluate(() => globalThis.createdUrls.every((url) => globalThis.revokedUrls.includes(url))), true);
  await assertEmpty(page);
  assert.deepEqual(errors, []);
});

test('a malformed report that fails mid-display leaves no hidden evidence or enabled export', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/bad', bad);
  result.completedAt = 'invalid-date';
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
  assert.equal(await page.locator('#report').isVisible(), false);
  for (const id of ['issue-rows', 'page-rows', 'detail-content', 'not-checked-list', 'report-time', 'report-host']) {
    assert.equal(await page.locator('#' + id).textContent(), '');
  }
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  assert.equal(await page.locator('#scan-spinner').isVisible(), false);
  assert.equal(await page.locator('#website-url').inputValue(), result.requestedUrl);
  assert.deepEqual(errors, []);
});
