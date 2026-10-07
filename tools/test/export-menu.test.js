const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { frontend, scan, report, bad, good } = require('./helpers/frontend');

const source = report('https://fixture.example/', bad);
const ids = ['export-json-button', 'export-xlsx-button', 'export-button', 'export-issues-xlsx-button'];

for (const width of [1280, 320]) {
  test('one download menu separates both export scopes and fits the viewport at ' + width + 'px', async (t) => {
    const { page, errors } = await frontend(t, { width, height: 900 });
    await page.route('**/api/audits', route => route.fulfill({ json: source }));
    assert.equal(await page.locator('#export-menu-button').isDisabled(), true);
    await scan(page, source.requestedUrl);
    assert.equal(await page.locator('#export-controls').count(), 1);
    assert.equal(await page.locator('#issues-pane [id^="export-"]').count(), 0);
    assert.equal(await page.locator('#export-controls > button:visible').count(), 1);
    assert.equal(await page.locator('#export-menu').isVisible(), false);
    assert.equal(await page.locator('#export-issue-count').textContent(), '(' + source.issues.length + ')');
    await page.locator('#issue-search').fill('image-alt');
    assert.equal(await page.locator('#export-issue-count').textContent(), '(1)');
    await page.locator('#export-menu-button').click();
    assert.equal(await page.locator('#export-menu-button').getAttribute('aria-expanded'), 'true');
    assert.deepEqual(await page.locator('#export-menu .dropdown-header').allTextContents(), [
      '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14',
      '\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e15\u0e32\u0e21\u0e15\u0e31\u0e27\u0e01\u0e23\u0e2d\u0e07 (1)'
    ]);
    const names = [];
    for (const id of ids) {
      const item = page.locator('#' + id);
      assert.equal(await item.isVisible(), true);
      assert.equal(await item.isDisabled(), false);
      names.push(await item.getAttribute('aria-label'));
    }
    assert.equal(new Set(names).size, 4);
    assert.equal(await page.locator('#export-menu').evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && element.scrollWidth <= element.clientWidth;
    }), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SEO_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-export-menu-' + width + '.png') });
    await page.locator('#export-menu-button').click();
    await page.locator('#pages-tab').click();
    assert.equal(await page.locator('#export-menu-button').isVisible(), true);
    await page.locator('#export-menu-button').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#export-json-button').evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#export-xlsx-button').evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#export-menu').isVisible(), false);
    assert.equal(await page.locator('#export-menu-button').evaluate(element => element === document.activeElement), true);
    assert.deepEqual(errors, []);
  });
}

test('empty filters and zero-issue rounds only disable filtered downloads, not the shared menu or full report', async (t) => {
  const clean = report(source.requestedUrl + 'clean', good);
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', route => route.fulfill({ json: route.request().postDataJSON().url === clean.requestedUrl ? clean : source }));
  await scan(page, source.requestedUrl);
  await page.locator('#issue-search').fill('no-matching-issue');
  for (const next of [false, true]) {
    if (next) await scan(page, clean.requestedUrl);
    assert.equal(await page.locator('#export-issue-count').textContent(), '(0)');
    assert.equal(await page.locator('#export-menu-button').isDisabled(), false);
    await page.locator('#export-menu-button').click();
    for (const id of ids) assert.equal(await page.locator('#' + id).isDisabled(), id === 'export-button' || id === 'export-issues-xlsx-button');
    await page.keyboard.press('Escape');
  }
  await page.reload();
  assert.equal(await page.locator('#export-menu-button').isDisabled(), true);
  assert.equal(await page.locator('#export-menu').isVisible(), false);
  assert.deepEqual(errors, []);
});

test('starting another audit closes the open download menu and failure leaves it disabled', async (t) => {
  const { page, errors } = await frontend(t);
  let pending;
  let received;
  const nextRequest = new Promise(resolve => { received = resolve; });
  let requests = 0;
  await page.route('**/api/audits', route => {
    if (++requests === 1) return route.fulfill({ json: source });
    pending = route;
    received();
  });
  await scan(page, source.requestedUrl);
  await page.locator('#export-menu-button').click();
  await page.locator('#scan-button').click();
  await nextRequest;
  assert.equal(await page.locator('#export-menu-button').isDisabled(), true);
  assert.equal(await page.locator('#export-menu-button').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#export-menu').getAttribute('class').then(value => value.includes('show')), false);
  for (const id of ids) assert.equal(await page.locator('#' + id).isDisabled(), true);
  await pending.fulfill({ status: 400, json: { ok: false, code: 'INVALID_URL', message: 'Fixture failure' } });
  await page.waitForFunction(() => document.getElementById('report').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator('#scan-status').getAttribute('data-state'), 'failed');
  assert.equal(await page.locator('#export-menu-button').isDisabled(), true);
  assert.deepEqual(errors, []);
});
