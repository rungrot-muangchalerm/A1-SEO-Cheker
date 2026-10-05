const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');
const { base, jsonResponse, key } = require('./helpers/pagespeed');
const markup = (title, content = '') => '<title>' + title + '</title><meta name="description" content="' + title + '">' + content;

test('multi-page crawl requests one Lighthouse URL, never averages across pages, and UI calls it URL-specific', async (t) => {
  key(t);
  const responses = [{ status: 404 }, { html: markup('Root', '<a href="/child">Child</a>') }, { status: 404 }, { html: markup('Child') }, jsonResponse()];
  const transport = stubTransport(t, responses);
  const result = (await audit.create({ url: base, crawl: true, pagespeed: true })).data;
  assert.equal(result.coverage.fetched, 2);
  assert.deepEqual(result.lighthouse.scope, { type: 'single-url', url: base });
  assert.equal(transport.calls.filter((entry) => new URL(entry.url).hostname === 'www.googleapis.com').length, 1);
  assert.equal(result.lighthouse.categories[0].displayScore, 72);
  assert.ok(result.pages.every((page) => page.lighthouse === undefined));
  t.mock.restoreAll();
  stubTransport(t, responses);
  const { page, errors } = await frontend(t);
  await page.locator('#crawl-pages').check();
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  assert.equal(await page.locator('#summary-pages').textContent(), '2');
  assert.ok((await page.locator('#audit-heading').textContent()).includes('URL ที่ตรวจ'));
  assert.ok((await page.locator('#lighthouse-metadata').textContent()).includes(base));
  assert.deepEqual(errors, []);
});
