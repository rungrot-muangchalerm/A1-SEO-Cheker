const test = require('node:test');
const assert = require('node:assert/strict');
const website = require('../../app/data/website.data');
const htmlService = require('../../app/service/html.service');
const sitemapService = require('../../app/service/sitemap.service');
const discoveryService = require('../../app/service/discovery.service');
const auditService = require('../../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');

const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const map = (urls) => '<urlset xmlns="' + ns + '">' + urls.map((url) => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>';
const page = (html) => {
  const data = { finalUrl: 'https://site.example/folder/start', html, robots: { sitemaps: [] } };
  data.metadata = htmlService.parse(data);
  return data;
};

test('finds internal links with document base, meaningful queries and source evidence', async (t) => {
  t.mock.method(website, 'fetchSitemap', async (url) => ({ status: 404, finalUrl: url, bytes: 0, redirects: [] }));
  const result = await discoveryService.discover(page('<head><base href="/catalog/"></head><body><a href="next?v=1#one">One</a><a href="next?v=1#two">Again</a><a href="next?v=2">Two</a><a href="https://external.example/">External</a><a href="javascript:alert(1)">JS</a>'));
  assert.deepEqual(result.urls.map((entry) => entry.url), ['https://site.example/folder/start', 'https://site.example/catalog/next?v=1', 'https://site.example/catalog/next?v=2']);
  assert.equal(result.urls[1].sources.length, 2);
  assert.equal(result.urls[1].sources[0].sourceUrl, 'https://site.example/folder/start');
  assert.ok(result.urls[1].sources[0].location.startLine);
  assert.ok(result.skipped.some((entry) => entry.reason === 'outside-origin'));
});

test('XML parser reads standard and prefixed namespaces, escaped URLs and CDATA as XML, not HTML', () => {
  const plain = sitemapService.parse(map(['https://site.example/?a=1&amp;b=2', 'https://site.example/second']));
  assert.equal(plain.type, 'urlset');
  assert.equal(plain.namespaceVerified, true);
  assert.equal(plain.entries[0].url, 'https://site.example/?a=1&b=2');
  const prefixed = sitemapService.parse('<s:urlset xmlns:s="' + ns + '" xmlns:image="https://foreign.example/"><s:url><s:loc><![CDATA[https://site.example/cdata?a=1&b=2]]></s:loc><image:loc>https://wrong.example/</image:loc></s:url></s:urlset>');
  assert.equal(prefixed.entries.length, 1);
  assert.equal(prefixed.entries[0].url, 'https://site.example/cdata?a=1&b=2');
  assert.equal(prefixed.entries[0].entryIndex, 1);
  const missingNs = sitemapService.parse('<urlset><url><loc>https://site.example/</loc></url></urlset>');
  assert.equal(missingNs.namespaceVerified, false);
});

test('malformed XML, DTDs, foreign roots and invalid location elements cannot produce invented page URLs', () => {
  for (const xml of ['<urlset><url></urlset>', '<html><body>Not a sitemap</body></html>',
    '<urlset xmlns="https://untrusted.example/"></urlset>', '<!DOCTYPE urlset [<!ENTITY x SYSTEM "file:///private">]><urlset></urlset>']) {
    assert.throws(() => sitemapService.parse(xml), website.WebsiteError);
  }
  const parsed = sitemapService.parse('<urlset><url><loc>/relative</loc></url><url><loc>https://a.example</loc><loc>https://b.example</loc></url><url><loc><nested>https://c.example</nested></loc></url></urlset>');
  assert.ok(parsed.entries.every((entry) => entry.url === null));
  assert.equal({}.polluted, undefined);
});

test('opt-in API discovery reads robots-declared and default sitemaps without treating found URLs as fetched pages', async (t) => {
  const transport = stubTransport(t, [
    { html: '<title>Start</title><a href="/linked">Linked</a>' },
    { html: 'User-agent: *\nAllow: /\nSitemap: https://site.example/custom.xml', headers: { 'content-type': 'text/plain' } },
    { html: map(['https://site.example/from-robots?a=1&amp;b=2']), headers: { 'content-type': 'application/xml' } },
    { html: map(['https://site.example/default']), headers: { 'content-type': 'text/xml' } }
  ]);
  const result = await auditService.create({ url: 'https://site.example/', discover: true });
  assert.equal(result.ok, true);
  const data = result.data;
  assert.deepEqual(transport.calls.map((entry) => entry.url), ['https://site.example/', 'https://site.example/robots.txt', 'https://site.example/custom.xml', 'https://site.example/sitemap.xml']);
  assert.deepEqual(data.discovery.urls.map((entry) => entry.url), ['https://site.example/', 'https://site.example/linked', 'https://site.example/from-robots?a=1&b=2', 'https://site.example/default']);
  assert.equal(data.coverage.discovered, 4);
  assert.equal(data.coverage.fetched, 1);
  assert.equal(data.summary.pages, 1);
  assert.equal(data.status, 'partial');
  assert.ok(data.notChecked.some((entry) => entry.id === 'site-crawl' && entry.reason === 'not-implemented'));
  assert.equal(data.discovery.urls[2].sources[0].sourceUrl, 'https://site.example/custom.xml');
  assert.equal(data.discovery.sitemaps[0].httpStatus, 200);
});

test('single-page requests do not start sitemap discovery implicitly', async (t) => {
  const transport = stubTransport(t, [{ html: good }, { status: 404 }]);
  const result = await auditService.create({ url: 'https://site.example/' });
  assert.equal(result.ok, true);
  assert.equal(transport.calls.length, 2);
  assert.equal(Object.hasOwn(result.data, 'discovery'), false);
});

test('sitemap failures remain unavailable and private redirects are blocked by protected transport', async (t) => {
  const transport = stubTransport(t, [
    { html: good }, { html: 'Sitemap: https://site.example/private.xml' },
    { status: 302, headers: { location: 'http://127.0.0.1/' } },
    { html: '<urlset>broken', headers: { 'content-type': 'application/xml' } }
  ]);
  const result = await auditService.create({ url: 'https://site.example/', discover: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.discovery.urls.map((entry) => entry.url), ['https://site.example/', 'https://site.example/registration?session=2']);
  assert.equal(result.data.discovery.sitemaps[0].reason, 'OUTSIDE_SCOPE');
  assert.equal(result.data.discovery.sitemaps[1].reason, 'SITEMAP_INVALID_XML');
  assert.ok(transport.calls.every((entry) => !entry.url.includes('127.0.0.1')));
  assert.equal(result.data.notChecked.filter((entry) => entry.id === 'sitemap-discovery').length, 2);
});

test('checkbox runs actual discovery API flow and shows found URLs separately from analyzed pages; refresh clears it', async (t) => {
  const transport = stubTransport(t, [
    { html: good + '<a href="/linked">Next</a>' },
    { html: 'Sitemap: https://site.example/custom.xml' },
    { html: map(['https://site.example/from-map']), headers: { 'content-type': 'application/xml' } },
    { status: 404 }
  ]);
  const { page: browserPage, errors } = await frontend(t);
  await browserPage.locator('#discover-pages').check();
  await scan(browserPage, 'https://site.example/');
  assert.ok(transport.calls.some((entry) => entry.url === 'https://site.example/custom.xml'));
  assert.equal(await browserPage.locator('#summary-pages').textContent(), '1');
  await browserPage.locator('#discovery-section summary').click();
  assert.ok((await browserPage.locator('#discovery-list').textContent()).includes('https://site.example/from-map'));
  assert.equal(await browserPage.locator('[data-discovered-url="https://site.example/from-map"]').count(), 1);
  assert.equal(await browserPage.locator('#page-rows tr').count(), 1);
  await browserPage.reload();
  await browserPage.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(await browserPage.locator('#discover-pages').isChecked(), false);
  assert.equal(await browserPage.locator('#discovery-list').textContent(), '');
  assert.equal(await browserPage.locator('#discovery-section').isVisible(), false);
  assert.deepEqual(errors, []);
});

test('sitemap discovery cancellation stops protected transport and does not publish a partial discovery', { timeout: 3000 }, async (t) => {
  const transport = stubTransport(t, [{ html: good }, { status: 404 }, { neverRespond: true }]);
  const controller = new AbortController();
  const operation = auditService.create({ url: 'https://site.example/', discover: true }, { signal: controller.signal });
  while (transport.calls.length < 3) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  const result = await operation;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CANCELLED');
  assert.equal(Object.hasOwn(result, 'data'), false);
  assert.equal(transport.connections.at(-1).destroyed, true);
});
