const test = require('node:test');
const assert = require('node:assert/strict');
const timers = require('node:timers/promises');
const path = require('node:path');
const os = require('node:os');
const audit = require('../app/service/audit.service');
const model = require('../app/model/audit.model');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, report, good } = require('./helpers/frontend');

const base = 'https://site.example/';
const script = (value) => '<script type="application/ld+json">' + value + '</script>';
const root = '<meta name="description" content="Root"><link rel="canonical" href="/">' +
  script('{broken}') + script('7') + '<a href="/child">Child</a>';
const child = '<meta name="description" content="Child"><link rel="canonical" href="/child">' + script('{another broken}');

function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
}

async function fixture(t) {
  clock(t);
  stubTransport(t, [{ status: 404 }, { html: root }, { status: 404 }, { html: child }]);
  const result = await audit.create({ url: base, crawl: true });
  assert.equal(result.ok, true);
  return result.data;
}

test('real page rules group by identity with mixed severities, unique URLs and counts equal to the actual issue summary', async (t) => {
  const result = await fixture(t);
  assert.equal(result.pages.length, 2);
  assert.equal(result.issues.length, 5);
  assert.equal(result.issueGroups.length, 2);
  const syntax = result.issueGroups.find((group) => group.ruleId === 'jsonld-syntax');
  assert.equal(syntax.count, 3);
  assert.deepEqual(syntax.severityCounts, { critical: 0, warning: 2, review: 1 });
  assert.deepEqual(syntax.urls, [base, base + 'child']);
  assert.equal(syntax.issueIds.length, new Set(syntax.issueIds).size);
  assert.ok(!syntax.title.includes('#'));
  assert.equal(syntax.complete, true);
  const members = result.issueGroups.flatMap((group) => group.issueIds);
  assert.deepEqual(members.slice().sort(), result.issues.map((issue) => issue.id).sort());
  for (const level of ['critical', 'warning', 'review']) {
    assert.equal(result.issueGroups.reduce((sum, group) => sum + group.severityCounts[level], 0), result.summary[level]);
  }
  assert.equal(result.issueGroups.reduce((sum, group) => sum + group.count, 0), result.issues.length);
  assert.equal(new Set(result.issueGroups.flatMap((group) => group.urls)).size, result.summary.affected);
  assert.ok(!result.issueGroups.some((group) => group.ruleId === 'canonical-target' || group.ruleId === 'duplicate-title'));
  assert.equal(result.lighthouse.categories.length, 0);
});

test('group completeness follows member proof; affected unread resources do not become HTML pages; arrays are fresh each round', () => {
  const page = report(base, good).pages[0];
  const check = { ...page.checks[0], id: 'actual-resource', ruleId: 'resource-rule', outcome: 'fail', severity: 'warning',
    urls: [base, base + 'unread.json'], complete: false };
  const input = { ...page, checks: [...page.checks, check] };
  const first = model.createReport(input, new Date().toISOString());
  assert.equal(first.issueGroups.length, 1);
  assert.equal(first.issueGroups[0].complete, false);
  assert.equal(first.summary.affected, 2);
  assert.equal(first.summary.pages, 1);
  first.issueGroups[0].issueIds.push('old-member');
  first.issueGroups[0].urls.push(base + 'old');
  first.issueGroups[0].severityCounts.warning = 99;
  const second = model.createReport(input, new Date().toISOString());
  assert.deepEqual(second.issueGroups[0].issueIds, ['actual-resource']);
  assert.deepEqual(second.issueGroups[0].urls, [base, base + 'unread.json']);
  assert.equal(second.issueGroups[0].severityCounts.warning, 1);
  const empty = model.createReport(page, new Date().toISOString());
  assert.deepEqual(empty.issueGroups, []);
  assert.equal(empty.summary.warning, 0);
});

test('grouped UI filters members before counting; details and CSV retain individual evidence rather than a misleading grouped row', async (t) => {
  const result = await fixture(t);
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, base);
  assert.equal(await page.locator('#issue-rows tr').count(), result.issues.length);
  await page.locator('label[for="issue-view-groups"]').click();
  assert.equal(await page.locator('[data-issue-group]').count(), result.issueGroups.length);
  assert.ok((await page.locator('#issue-result-status').textContent()).includes('5'));
  assert.equal(await page.locator('#summary-warning').textContent(), '4');
  assert.equal(await page.locator('#summary-review').textContent(), '1');
  const syntax = page.locator('[data-issue-group="jsonld-syntax"]');
  assert.equal(await syntax.locator('[data-group-count]').textContent(), '3');
  assert.equal(await syntax.locator('[data-group-severity]').count(), 2);
  await page.locator('#severity-filter').selectOption('warning');
  assert.equal(await syntax.locator('[data-group-count]').textContent(), '2');
  assert.equal(await syntax.locator('[data-group-severity]').count(), 1);
  await page.locator('#category-filter').selectOption('onpage');
  await page.locator('#issue-search').fill('jsonld-syntax');
  assert.equal(await page.locator('[data-issue-group]').count(), 1);
  assert.ok((await page.locator('#issue-result-status').textContent()).includes('2 URL'));
  await syntax.locator('[data-issue-id]').click();
  assert.equal(await page.locator('[data-group-members] [data-issue-id]').count(), 2);
  assert.equal(await page.locator('[data-group-urls] [data-page-url]').count(), 2);
  const badSyntax = result.issues.find((issue) => issue.ruleId === 'jsonld-syntax' && issue.url === base && issue.severity === 'warning');
  await page.locator('[data-group-members] [data-issue-id="' + badSyntax.id + '"]').click();
  assert.equal(await page.locator('#detail-title').textContent(), badSyntax.title);
  assert.ok((await page.locator('#detail-content pre').first().textContent()).includes('{broken}'));
  await page.locator('#issue-drawer .btn-close').click();
  await page.locator('#issue-drawer').waitFor({ state: 'hidden' });
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-button').click();
  const stream = await (await downloaded).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  assert.equal((csv.match(/"jsonld-syntax"/g) || []).length, 2);
  assert.ok(csv.includes('{broken}') && csv.includes('{another broken}'));
  assert.ok(!csv.includes('issue-group:') && !csv.includes('"review"'));
  await page.locator('#severity-filter').selectOption('review');
  assert.equal(await syntax.locator('[data-group-count]').textContent(), '1');
  assert.ok((await page.locator('#issue-result-status').textContent()).includes('1 URL'));
  await page.locator('#issue-search').fill('no-such-member');
  assert.equal(await page.locator('#issue-rows tr').count(), 0);
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  await page.locator('#reset-filters').click();
  assert.equal(await page.locator('[data-issue-group]').count(), 2);
  assert.deepEqual(errors, []);
});

test('desktop/mobile groups and drawers escape untrusted labels and URLs; new scans and refresh remove old groups and reset the view', async (t) => {
  const result = await fixture(t);
  const syntax = result.issueGroups.find((group) => group.ruleId === 'jsonld-syntax');
  syntax.title = '<img src=x onerror="globalThis.__groupXss=true">' + 'Long'.repeat(35);
  const unread = base + '?unsafe=<img src=x onerror="globalThis.__groupXss=true">';
  const member = result.issues.find((issue) => issue.id === syntax.issueIds[0]);
  member.urls.push(unread);
  syntax.urls.push(unread);
  member.title = syntax.title;
  result.summary.affected = new Set(result.issues.flatMap((issue) => issue.urls)).size;
  const { page, errors } = await frontend(t);
  let current = result;
  await page.route('**/api/audits', (route) => route.fulfill({ json: current }));
  await scan(page, base);
  await page.locator('label[for="issue-view-groups"]').click();
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await page.locator('#issues-pane').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SEO_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-groups-' + name + '.png'), fullPage: false });
  }
  await page.locator('[data-issue-group="jsonld-syntax"] [data-issue-id]').click();
  await page.waitForFunction(() => {
    const drawer = document.getElementById('issue-drawer');
    return drawer.classList.contains('show') && !drawer.classList.contains('showing');
  });
  assert.equal(await page.locator('[data-group-members] img, [data-group-urls] img, #detail-title img').count(), 0);
  assert.equal(await page.locator('[data-group-urls] [data-unfetched-url]').count(), 1);
  assert.ok((await page.locator('[data-group-urls]').textContent()).includes(unread));
  assert.equal(await page.evaluate(() => globalThis.__groupXss), undefined);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#issue-drawer .btn-close').click();
  await page.locator('#issue-drawer').waitFor({ state: 'hidden' });
  current = report(base, good);
  await scan(page, base);
  assert.equal(await page.locator('#issue-view-list').isChecked(), true);
  assert.equal(await page.locator('[data-issue-group]').count(), 0);
  assert.equal(await page.locator('#detail-content').textContent(), '');
  await page.locator('label[for="issue-view-groups"]').click();
  assert.equal(await page.locator('#issue-rows tr').count(), 0);
  await page.reload();
  assert.equal(await page.locator('#issue-view-list').isChecked(), true);
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.equal(await page.locator('#issue-rows').textContent(), '');
  assert.deepEqual(errors, []);
});
