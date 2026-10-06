const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');
const { base, stubLighthouse } = require('./helpers/lighthouse');
const markup = (title, content = '') => '<title>' + title + '</title><meta name="description" content="' + title + '">' + content;

test('multi-page crawl runs one Lighthouse URL, never averages pages, and UI calls it URL-specific', async (t) => {
  const engine = stubLighthouse(t);
  const responses = [{ status: 404 }, { html: markup('Root', '<a href="/child">Child</a>') }, { status: 404 }, { html: markup('Child') }];
  stubTransport(t, responses);
  const result = (await audit.create({ url: base, crawl: true, lighthouse: true })).data;
  assert.equal(result.coverage.fetched, 2);
  assert.deepEqual(result.lighthouse.scope, { type: 'single-url', url: base });
  assert.deepEqual(engine.calls, [{ url: base, strategy: undefined }]);
  assert.equal(result.lighthouse.categories[0].displayScore, 72);
  assert.ok(result.pages.every((page) => page.lighthouse === undefined));
  t.mock.restoreAll();
  stubTransport(t, responses);
  stubLighthouse(t);
  const { page, errors } = await frontend(t);
  await page.locator('#crawl-pages').check();
  await scan(page, base, { lighthouse: true });
  assert.equal(await page.locator('#summary-pages').textContent(), '2');
  assert.ok((await page.locator('#audit-heading').textContent()).includes('URL ที่ตรวจ'));
  assert.ok((await page.locator('#lighthouse-metadata').textContent()).includes(base));
  assert.deepEqual(errors, []);
});

test('obsolete remote flags and string lighthouse flags cannot start an engine or third-party request', async (t) => {
  const engine = stubLighthouse(t, []);
  const transport = stubTransport(t, [{ html: markup('Root') }, { status: 404 }]);
  const result = await audit.create({ url: base, pagespeed: true, lighthouse: 'true', key: 'CLIENT_KEY' });
  assert.equal(result.ok, true);
  assert.equal(result.data.lighthouse.status, 'not-checked');
  assert.equal(result.data.lighthouse.reason, 'not-requested');
  assert.equal(engine.calls.length, 0);
  assert.equal(transport.calls.length, 2);
});
