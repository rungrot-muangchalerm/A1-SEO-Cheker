const test = require('node:test');
const assert = require('node:assert/strict');
const website = require('../app/data/website.data');
const audit = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');

test('scoped transport refuses foreign targets before DNS or sockets, including each redirect', async (t) => {
  const transport = stubTransport(t, []);
  const origin = 'https://site.example';
  for (const target of ['https://other.example/', 'https://sub.site.example/', 'http://site.example/',
    'https://site.example.attacker.example/', 'http://127.0.0.1/']) {
    await assert.rejects(website.fetchPage(target, { scopeOrigin: origin }), { code: 'OUTSIDE_SCOPE' });
  }
  assert.deepEqual(transport.calls, []);
  assert.deepEqual(transport.resolvers, []);
  t.mock.restoreAll();
  const redirects = stubTransport(t, [{ status: 302, headers: { location: 'https://outside.example/map.xml' } }]);
  await assert.rejects(website.fetchSitemap(origin + '/map.xml', { scopeOrigin: origin }), { code: 'OUTSIDE_SCOPE' });
  assert.deepEqual(redirects.resolvers, ['site.example']);
  assert.deepEqual(redirects.calls.map((entry) => entry.url), [origin + '/map.xml']);
});

test('initial explicit URL may redirect; follow-up scope is the final origin, not body options', async (t) => {
  const transport = stubTransport(t, [
    { status: 301, headers: { location: 'https://www.site.example/start' } },
    { html: '<title>Start</title><a href="/inside">In</a><a href="https://site.example/outside">Out</a>' },
    { html: 'Sitemap: https://site.example/map.xml\nSitemap: https://www.site.example/custom.xml' },
    { status: 302, headers: { location: 'https://attacker.example/map.xml' } },
    { status: 404 }
  ]);
  const result = await audit.create({ url: 'http://site.example/', discover: true, scopeOrigin: 'https://attacker.example', maxUrls: 99999 });
  assert.equal(result.ok, true);
  assert.equal(result.data.scope.origin, 'https://www.site.example');
  assert.deepEqual(result.data.discovery.urls.map((entry) => entry.url), ['https://www.site.example/start', 'https://www.site.example/inside']);
  assert.ok(result.data.discovery.skipped.some((entry) => entry.reason === 'outside-origin' && entry.kind === 'sitemap'));
  assert.equal(result.data.discovery.sitemaps[0].reason, 'OUTSIDE_SCOPE');
  assert.equal(result.data.discovery.limits.maxUrls, 200);
  assert.ok(transport.calls.every((entry, i) => i === 0 || new URL(entry.url).origin === 'https://www.site.example'));
  assert.ok(!transport.resolvers.includes('attacker.example'));
});

test('robots redirects cannot escape the selected origin or silently become known rules', async (t) => {
  const transport = stubTransport(t, [{ html: '<title>Root</title>' },
    { status: 302, headers: { location: 'https://external.example/robots.txt' } }]);
  const result = await audit.create({ url: 'https://site.example/' });
  assert.equal(result.ok, true);
  assert.equal(result.data.pages[0].robots.status, 'not-checked');
  assert.equal(result.data.pages[0].robots.reason, 'OUTSIDE_SCOPE');
  assert.ok(result.data.notChecked.some((entry) => entry.id === 'robots-crawling'));
  assert.deepEqual(transport.resolvers, ['site.example', 'site.example']);
});

test('same-origin redirects keep query strings while fragments do not widen scope', async (t) => {
  const transport = stubTransport(t, [{ status: 302, headers: { location: '/result?v=2#part' } }, { html: '<title>Result</title>' }]);
  const result = await website.fetchPage('https://SITE.example:443/start?v=1', { scopeOrigin: 'https://site.example' });
  assert.equal(result.finalUrl, 'https://site.example/result?v=2');
  assert.deepEqual(transport.calls.map((entry) => entry.url), ['https://site.example/start?v=1', 'https://site.example/result?v=2']);
});
