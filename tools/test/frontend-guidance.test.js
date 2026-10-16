const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report, bad } = require('./helpers/frontend');

test('report explains concrete fixes without a summary banner', async t => {
  const { page, errors } = await frontend(t, { width: 390, height: 844 });
  const result = report('https://fixture.example/', bad);
  await page.route('**/api/audits', route => route.fulfill({ json: result }));
  await scan(page, 'https://fixture.example/');
  assert.equal(await page.locator('#not-checked-section').getAttribute('open'), '');
  assert.ok((await page.locator('#issue-rows').textContent()).includes('ทำไมต้องดูข้อนี้'));
  assert.equal(await page.locator('#verdict-heading, #verdict-description').count(), 0);
  const issue = result.issues.find(issue => issue.ruleId === 'description-content');
  await page.locator('[data-issue-id="' + issue.id + '"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  const guide = page.locator('[data-code-guide]');
  assert.ok((await guide.textContent()).includes('<head>'));
  assert.ok((await guide.locator('code').textContent()).includes('<meta name="description"'));
  assert.equal(await guide.locator('meta').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
});
