const test = require('node:test');
const assert = require('node:assert/strict');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good, bad, report } = require('./helpers/frontend');
const { base, jsonResponse, key } = require('./helpers/pagespeed');

async function readDownload(page, selector) {
  const event = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await event;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { text: Buffer.concat(chunks).toString('utf8'), filename: download.suggestedFilename() };
}

test('manual JSON contains the entire actual API round, independent of issue filters, including HTML evidence and source scores', async (t) => {
  key(t);
  stubTransport(t, [{ html: bad }, { status: 404 }, jsonResponse()]);
  const { page, errors } = await frontend(t);
  assert.equal(await page.locator('#export-json-button').isDisabled(), true);
  const response = page.waitForResponse((response) => response.url().endsWith('/api/audits'));
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  const original = await (await response).json();
  await page.locator('#issue-search').fill('no-matching-issue');
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  assert.equal(await page.locator('#export-json-button').isDisabled(), false);
  const downloaded = await readDownload(page, '#export-json-button');
  assert.deepEqual(JSON.parse(downloaded.text), original);
  assert.equal(JSON.parse(downloaded.text).pages[0].html, bad);
  assert.equal(JSON.parse(downloaded.text).lighthouse.categories[0].displayScore, 72);
  assert.ok(JSON.parse(downloaded.text).notChecked.length > 0);
  assert.ok(!downloaded.text.includes('SERVER_ONLY_TEST_KEY'));
  assert.deepEqual(errors, []);
});

test('zero-issue rounds still export JSON; exported HTML is inert text and never produces markup or runs source code', async (t) => {
  const source = good.replace('</body>', '<script>globalThis.__jsonXss=true;</script></body>');
  const result = report(base, source);
  const { page, errors } = await frontend(t, { width: 390, height: 844 });
  await page.route('**/api/audits', route => route.fulfill({ json: result }));
  await scan(page, base);
  assert.equal(await page.locator('#export-json-button').isDisabled(), false);
  const downloaded = await readDownload(page, '#export-json-button');
  assert.equal(JSON.parse(downloaded.text).pages[0].html, source);
  assert.equal(await page.evaluate(() => globalThis.__jsonXss), undefined);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
});

module.exports = { readDownload };
