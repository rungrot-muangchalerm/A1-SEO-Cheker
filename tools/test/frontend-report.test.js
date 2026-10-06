const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report, good, bad } = require('./helpers/frontend');

test('summary, issues, pages and both detail views read the same real report fields', async (t) => {
  const { page, errors } = await frontend(t);
  const url = 'https://fixture.example/bad?version=2';
  const result = report(url, bad, { status: 404, headers: { 'x-robots-tag': 'googlebot: nofollow' },
    robots: { kind: 'robots', url: 'https://fixture.example/robots.txt', status: 'checked', googlebotAllowed: false,
      rules: [{ agent: 'Googlebot', line: 2, source: 'Disallow: /bad' }] } });
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, url);
  assert.equal(await page.locator('#report').isVisible(), true);
  for (const field of ['pages', 'critical', 'warning', 'review']) {
    assert.equal(await page.locator('#summary-' + field).textContent(), String(result.summary[field]));
  }
  assert.equal(await page.locator('#issue-rows tr').count(), result.issues.length);
  for (const issue of result.issues) {
    assert.equal(await page.locator('[data-issue-id="' + issue.id + '"]').count(), 1);
  }
  await page.locator('[data-issue-id="image-alt"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  const alt = result.issues.find((issue) => issue.ruleId === 'image-alt');
  assert.equal(await page.locator('#detail-title').textContent(), alt.title);
  const details = await page.locator('#detail-content').textContent();
  assert.ok(details.includes(alt.found));
  assert.ok(details.includes(alt.impact));
  assert.ok(details.includes(alt.steps[0]));
  assert.ok(details.includes('missing-alt.jpg'));
  assert.ok(details.includes(url));
  assert.equal(await page.locator('#detail-content img').count(), 0);
  await page.locator('#issue-drawer [data-bs-dismiss="offcanvas"]').click();
  await page.locator('#issue-drawer.show').waitFor({ state: 'hidden' });
  await page.locator('#pages-tab').click();
  assert.equal(await page.locator('#page-rows tr').count(), result.pages.length);
  assert.ok((await page.locator('#page-rows').textContent()).includes(url));
  assert.ok((await page.locator('#page-rows').textContent()).includes('404'));
  await page.locator('#page-rows [data-page-url]').click();
  await page.locator('#issue-drawer.show').waitFor();
  assert.equal(await page.locator('#detail-content [data-issue-id]').count(), result.issues.length);
  const code = await page.locator('#detail-content details code').allTextContents();
  assert.equal(code[0], JSON.stringify(result.pages[0].headers, null, 2));
  assert.equal(code[1], result.pages[0].html);
  assert.equal(await page.evaluate(() => globalThis.__auditFixtureScriptRan), undefined);
  assert.deepEqual(errors, []);
});

test('a new successful round replaces the previous report in every view', async (t) => {
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', (route) => {
    const url = route.request().postDataJSON().url;
    return route.fulfill({ json: report(url, url.includes('/bad') ? bad : good) });
  });
  await scan(page, 'https://fixture.example/bad');
  assert.ok(await page.locator('#issue-rows tr').count() > 0);
  await scan(page, 'https://fixture.example/good');
  assert.equal(await page.locator('#issue-rows tr').count(), 0);
  assert.equal(await page.locator('#summary-warning').textContent(), '0');
  assert.equal(await page.locator('#summary-review').textContent(), '0');
  assert.equal(await page.locator('#detail-content').textContent(), '');
  await page.locator('#pages-tab').click();
  assert.equal(await page.locator('#page-rows tr').count(), 1);
  assert.ok((await page.locator('#page-rows').textContent()).includes('Workshop Schedule | Sample Studio'));
  assert.equal((await page.locator('#page-rows').textContent()).includes('/bad'), false);
  assert.deepEqual(errors, []);
});

test('mobile report and detail drawer show actual evidence without horizontal page overflow', async (t) => {
  const { page, errors } = await frontend(t, { width: 390, height: 844 });
  await page.route('**/api/audits', (route) => route.fulfill({ json: report('https://fixture.example/bad', bad) }));
  await scan(page, 'https://fixture.example/bad');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-issue-id="image-alt"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.ok((await page.locator('#detail-content').textContent()).includes('missing-alt.jpg'));
  assert.deepEqual(errors, []);
});
