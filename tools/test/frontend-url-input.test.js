const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report } = require('./helpers/frontend');

test('website input accepts domains and local ports without requiring a protocol', async t => {
  const { page, errors } = await frontend(t);
  const requests = [];
  await page.route('**/api/audits', route => {
    const body = route.request().postDataJSON();
    requests.push(body.url);
    return route.fulfill({ json: report(body.url) });
  });
  for (const [entered, expected] of [
    ['example.com/path?q=1', 'https://example.com/path?q=1'],
    ['localhost:3000', 'http://localhost:3000/'],
    ['127.0.0.1:3000/page', 'http://127.0.0.1:3000/page'],
    ['[::1]:3000', 'http://[::1]:3000/'],
    ['http://example.com', 'http://example.com/'],
    ['https://example.com', 'https://example.com/']
  ]) {
    await scan(page, entered);
    assert.equal(requests.at(-1), expected);
  }
  assert.deepEqual(errors, []);
});
