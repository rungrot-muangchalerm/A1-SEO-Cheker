const test = require('node:test');
const assert = require('node:assert/strict');
const robots = require('../../app/service/robots.service');
const website = require('../../app/data/website.data');
const { stubTransport } = require('./helpers/transport');

test('fetches the correct root with protected transport and distinguishes crawler scopes', async (t) => {
  const transport = stubTransport(t, [{ headers: { 'content-type': 'text/plain' }, html: [
    'User-agent: *', 'Disallow: /private', 'Allow: /private/public',
    'User-agent: Googlebot', 'Disallow: /private/public',
    'Sitemap: https://site.example/sitemap.xml', 'User-agent: SEOChecker', 'Allow: /', 'Crawl-delay: 2'
  ].join('\r\n') }]);
  const result = await robots.load('https://site.example/private/public?version=2');
  assert.equal(transport.calls[0].url, 'https://site.example/robots.txt');
  assert.equal(result.status, 'checked');
  assert.equal(result.googlebotAllowed, false);
  assert.equal(result.crawlerAllowed, true);
  assert.equal(result.rules[0].line, 5);
  assert.equal(result.rules[0].source, 'Disallow: /private/public');
  assert.equal(result.crawlDelay, 2);
  assert.deepEqual(result.sitemaps, ['https://site.example/sitemap.xml']);
});

test('most specific rule, allow ties, wildcards, queries and empty disallow are parsed', async (t) => {
  const text = ['User-agent: *', 'Disallow: /private', 'Allow: /private/public',
    'Disallow: /*?draft=*', 'Allow: /same', 'Disallow: /same', 'Disallow:'].join('\n');
  t.mock.method(website, 'fetchRobots', async (url) => ({ finalUrl: url, status: 200, text, bytes: text.length, redirects: [] }));
  for (const [path, allowed] of [['/private/secret', false], ['/private/public', true], ['/same', true], ['/?draft=yes', false], ['/', true]]) {
    const result = await robots.load('https://site.example' + path);
    assert.equal(result.googlebotAllowed, allowed, path);
  }
});

test('robots noindex is unsupported and does not become a meta noindex finding', async (t) => {
  stubTransport(t, [{ html: 'User-agent: *\nNoindex: /\nDisallow:' }]);
  const result = await robots.load('https://site.example/');
  assert.equal(result.googlebotAllowed, true);
  assert.equal(result.noindex, undefined);
});

test('robots uses UTF-8 and tolerates a UTF-8 BOM instead of trusting a legacy header charset', async (t) => {
  stubTransport(t, [{
    headers: { 'content-type': 'text/plain; charset=windows-1252' },
    html: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('User-agent: *\nDisallow: /blocked')])
  }]);
  assert.equal((await robots.load('https://site.example/blocked')).googlebotAllowed, false);
});

test('4xx except 429 means absent rules, not a mandatory missing-file issue', async (t) => {
  stubTransport(t, [404, 401, 403, 410].map((status) => ({ status, headers: { 'content-type': null } })));
  for (const status of [404, 401, 403, 410]) {
    const result = await robots.load('https://site.example/');
    assert.equal(result.status, 'absent');
    assert.equal(result.httpStatus, status);
    assert.equal(result.googlebotAllowed, true);
  }
});

test('rate limiting, server failures and DNS errors remain unknown without cached history', async (t) => {
  stubTransport(t, [{ status: 429 }, { status: 503 }]);
  for (const status of [429, 503]) {
    const result = await robots.load('https://site.example/');
    assert.equal(result.status, 'not-checked');
    assert.equal(result.httpStatus, status);
    assert.equal(result.googlebotAllowed, undefined);
  }
  t.mock.method(website, 'fetchRobots', async () => { throw new website.WebsiteError('DNS_FAILED'); });
  assert.equal((await robots.load('https://site.example/')).reason, 'DNS_FAILED');
});

test('redirects retain the original robots origin and cannot access private destinations', async (t) => {
  stubTransport(t, [
    { status: 302, headers: { location: '/shared-robots.txt' } },
    { html: 'User-agent: *\nDisallow: /blocked' },
    { status: 302, headers: { location: 'http://127.0.0.1/private' } }
  ]);
  const result = await robots.load('https://site.example/blocked');
  assert.equal(result.googlebotAllowed, false);
  assert.equal(result.finalUrl, 'https://site.example/shared-robots.txt');
  assert.equal((await robots.load('https://site.example/')).reason, 'OUTSIDE_SCOPE');
});

test('size, time and rule complexity are bounded and do not fabricate allowed crawling', async (t) => {
  stubTransport(t, [{ neverRespond: true }, { html: 'x'.repeat(500 * 1024 + 1) }]);
  await assert.rejects(website.fetchRobots('https://site.example/robots.txt', { timeoutMs: 25 }), { code: 'TIMEOUT' });
  assert.equal((await robots.load('https://site.example/')).reason, 'RESPONSE_TOO_LARGE');
  t.mock.method(website, 'fetchRobots', async (url) => ({ finalUrl: url, status: 200, text: '# comment\n'.repeat(2001), redirects: [] }));
  const result = await robots.load('https://site.example/');
  assert.equal(result.reason, 'ROBOTS_TOO_COMPLEX');
  assert.equal(result.googlebotAllowed, undefined);
});

test('cancellation aborts robots loading and propagates instead of publishing a partial report', async (t) => {
  const transport = stubTransport(t, [{ neverRespond: true }]);
  const controller = new AbortController();
  const operation = robots.load('https://site.example/', { signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(operation, { code: 'CANCELLED' });
  assert.ok(transport.connections.every((connection) => connection.destroyed));
});
