const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const website = require('../app/data/website.data');
const html = require('../app/service/html.service');
const maps = require('../app/service/sitemap.service');
const discovery = require('../app/service/discovery.service');
const auditService = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');

const xml = (type, entries) => '<' + type + ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries.map((value) =>
  '<' + (type === 'urlset' ? 'url' : 'sitemap') + '><loc>' + value + '</loc></' + (type === 'urlset' ? 'url' : 'sitemap') + '>').join('') + '</' + type + '>';
const page = () => {
  const data = { finalUrl: 'https://site.example/', html: '<title>Root</title>', robots: { sitemaps: [] } };
  data.metadata = html.parse(data);
  return data;
};

test('protected transport follows nested sitemap indexes and preserves parent file evidence', async (t) => {
  const transport = stubTransport(t, [
    { html: '<title>Root</title>' }, { status: 404 },
    { html: xml('sitemapindex', ['https://site.example/nested.xml', 'https://site.example/pages.xml']), headers: { 'content-type': 'application/xml' } },
    { html: xml('sitemapindex', ['https://site.example/child.xml']), headers: { 'content-type': 'application/xml' } },
    { html: xml('urlset', ['https://site.example/page?a=1&amp;b=2']), headers: { 'content-type': 'application/xml' } },
    { html: xml('urlset', ['https://site.example/child-page']), headers: { 'content-type': 'application/xml' } }
  ]);
  const result = await auditService.create({ url: 'https://site.example/', discover: true });
  assert.equal(result.ok, true);
  assert.equal(result.data.discovery.sitemaps.length, 4);
  assert.ok(result.data.discovery.sitemaps.every((entry) => entry.status === 'checked'));
  assert.equal(result.data.discovery.sitemaps[3].sourceUrl, 'https://site.example/nested.xml');
  assert.equal(result.data.discovery.sitemaps[3].entryIndex, 1);
  assert.deepEqual(result.data.discovery.urls.map((entry) => entry.url), ['https://site.example/', 'https://site.example/page?a=1&b=2', 'https://site.example/child-page']);
  assert.equal(transport.calls.length, 6);
  assert.equal(result.data.coverage.fetched, 1);
});

test('recursive indexes, duplicate references and redirect aliases are not repeatedly fetched', async (t) => {
  const requested = [];
  t.mock.method(website, 'fetchSitemap', async (url) => {
    requested.push(url);
    if (url.endsWith('/sitemap.xml')) return { status: 200, finalUrl: 'https://site.example/actual.xml',
      text: xml('sitemapindex', ['https://site.example/actual.xml', 'https://site.example/child.xml', 'https://site.example/child.xml#part']) };
    return { status: 200, finalUrl: url, text: xml('sitemapindex', ['https://site.example/sitemap.xml']) };
  });
  const result = await discovery.discover(page());
  assert.deepEqual(requested, ['https://site.example/sitemap.xml', 'https://site.example/child.xml']);
  assert.equal(result.sitemaps.length, 2);
  assert.equal(result.limitReached, false);
});

test('file limit counts all root and index child attempts and discloses skipped children', async (t) => {
  const requested = [];
  t.mock.method(website, 'fetchSitemap', async (url) => {
    requested.push(url);
    return { status: 200, finalUrl: url, text: url.endsWith('/sitemap.xml') ?
      xml('sitemapindex', Array.from({ length: 8 }, (_, i) => 'https://site.example/map-' + i + '.xml')) : xml('urlset', [url.replace('.xml', '')]) };
  });
  const result = await discovery.discover(page());
  assert.equal(requested.length, discovery.limits.maxSitemaps);
  assert.equal(result.sitemaps.length, discovery.limits.maxSitemaps);
  assert.equal(result.limitReached, true);
  assert.equal(result.skipped.filter((entry) => entry.reason === 'sitemap-limit').length, 4);
});

test('remaining total deadline shortens later fetches and prevents further requests', async (t) => {
  let now = 1000;
  const timeouts = [];
  t.mock.method(Date, 'now', () => now);
  t.mock.method(website, 'fetchSitemap', async (url, options) => {
    timeouts.push(options.timeoutMs);
    now += 7000;
    return { status: 200, finalUrl: url, text: xml('sitemapindex', ['https://site.example/child.xml', 'https://site.example/last.xml']) };
  });
  const result = await discovery.discover(page());
  assert.deepEqual(timeouts, [5000, 3000]);
  assert.ok(result.skipped.some((entry) => entry.reason === 'sitemap-deadline'));
  assert.equal(result.limitReached, true);
});

test('XML byte, element and depth limits are disclosed without inferring complete sitemap coverage', () => {
  assert.throws(() => maps.parse(xml('urlset', ['x'.repeat(512 * 1024)])), { code: 'SITEMAP_TOO_LARGE' });
  const result = maps.parse(xml('urlset', Array.from({ length: 1001 }, (_, i) => 'https://site.example/page-' + i)));
  assert.equal(result.entries.length, 1000);
  assert.equal(result.totalEntries, 1001);
  assert.equal(result.truncated, true);
  assert.throws(() => maps.parse('<urlset>' + '<x>'.repeat(22) + '</x>'.repeat(22) + '</urlset>'), { code: 'SITEMAP_INVALID_XML' });
  assert.throws(() => maps.parse('<?xml version="1.0" encoding="ISO-8859-1"?><urlset/>'), { code: 'SITEMAP_ENCODING' });
});

test('sitemap MIME, charset, decompression and size are enforced by the shared transport', async (t) => {
  const body = xml('urlset', ['https://site.example/?x=1&amp;y=2']);
  stubTransport(t, [
    { chunks: [zlib.gzipSync(body)], headers: { 'content-type': 'application/xml', 'content-encoding': 'gzip' } },
    { html: '<html>HTML response</html>' },
    { html: body, headers: { 'content-type': 'application/xml; charset=iso-8859-1' } },
    { chunks: [Buffer.from([0xff, 0xfe])], headers: { 'content-type': 'application/xml' } },
    { chunks: [zlib.gzipSync('x'.repeat(512 * 1024 + 1))], headers: { 'content-type': 'application/xml', 'content-encoding': 'gzip' } }
  ]);
  const result = await website.fetchSitemap('https://site.example/map.xml');
  assert.equal(result.text, body);
  assert.equal(result.bytes, Buffer.byteLength(body));
  assert.equal(result.encoding, 'UTF-8');
  await assert.rejects(website.fetchSitemap('https://site.example/html'), { code: 'UNSUPPORTED_TYPE' });
  await assert.rejects(website.fetchSitemap('https://site.example/legacy'), { code: 'UNSUPPORTED_CHARSET' });
  await assert.rejects(website.fetchSitemap('https://site.example/invalid-utf8'), { code: 'UNSUPPORTED_CHARSET' });
  await assert.rejects(website.fetchSitemap('https://site.example/huge'), { code: 'RESPONSE_TOO_LARGE' });
});

test('strict XML validation rejects undeclared entities, unbound prefixes and illegal character references', () => {
  for (const source of [
    '<urlset><url><loc>https://site.example/?x=&undeclared;</loc></url></urlset>',
    '<p:urlset><p:url><p:loc>https://site.example/</p:loc></p:url></p:urlset>',
    '<urlset><url><loc>https://site.example/?x=&#0;</loc></url></urlset>'
  ]) assert.throws(() => maps.parse(source), { code: 'SITEMAP_INVALID_XML' });
  const commented = maps.parse('<!-- <!DOCTYPE example> -->' + xml('urlset', ['https://site.example/?x=1&amp;y=2']));
  assert.equal(commented.entries[0].url, 'https://site.example/?x=1&y=2');
});
