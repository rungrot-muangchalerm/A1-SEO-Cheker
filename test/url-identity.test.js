const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/small-crawl-budgets').configure();
const website = require('../app/data/website.data');
const html = require('../app/service/html.service');
const discovery = require('../app/service/discovery.service');

const xml = (urls) => '<sitemapindex>' + urls.map((url) => '<sitemap><loc>' + url.replaceAll('&', '&amp;') + '</loc></sitemap>').join('') + '</sitemapindex>';
const document = (markup, sitemaps = []) => {
  const page = { finalUrl: 'https://site.example/start', html: markup, robots: { sitemaps } };
  page.metadata = html.parse(page);
  return page;
};

test('URL identity removes fragments and default ports but preserves query values, order, case and paths', async (t) => {
  t.mock.method(website, 'fetchSitemap', async (url) => ({ status: 404, finalUrl: url }));
  const result = await discovery.discover(document([
    '<a href="https://SITE.example:443/start#one">A</a>', '<a href="/folder/../start#two">B</a>',
    '<a href="/item?page=1">One</a>', '<a href="/item?page=2">Two</a>',
    '<a href="/item?a=1&amp;b=2">AB</a>', '<a href="/item?b=2&amp;a=1">BA</a>',
    '<a href="/Item">Case</a>', '<a href="/item/">Slash</a>', '<a href="/item?token=keep">Token</a>'
  ].join('')));
  assert.deepEqual(result.urls.map((entry) => entry.url), [
    'https://site.example/start', 'https://site.example/item?page=1', 'https://site.example/item?page=2',
    'https://site.example/item?a=1&b=2', 'https://site.example/item?b=2&a=1',
    'https://site.example/Item', 'https://site.example/item/', 'https://site.example/item?token=keep'
  ]);
  assert.equal(result.urls[0].sources.length, 3);
});

test('sitemap queue deduplicates before enqueue, keeps meaningful queries and breaks ancestor cycles', async (t) => {
  const calls = [];
  t.mock.method(website, 'fetchSitemap', async (url) => {
    calls.push(url);
    return { status: 200, finalUrl: url, text: url.endsWith('/sitemap.xml') ? xml([
      'https://SITE.example:443/map.xml?v=1#first', 'https://site.example/map.xml?v=1#second',
      'https://site.example/map.xml?v=2'
    ]) : xml(['https://site.example/sitemap.xml#ancestor', url]) };
  });
  const result = await discovery.discover(document('', ['https://site.example/sitemap.xml#duplicate']));
  assert.deepEqual(calls, ['https://site.example/sitemap.xml', 'https://site.example/map.xml?v=1', 'https://site.example/map.xml?v=2']);
  assert.equal(result.limitReached, false);
  assert.equal(result.sitemaps.length, 3);
});

test('generated query space and index queues stay bounded and disclose omitted work', async (t) => {
  const calls = [];
  t.mock.method(website, 'fetchSitemap', async (url) => {
    calls.push(url);
    return { status: 200, finalUrl: url, text: xml(Array.from({ length: 1000 }, (_, i) => 'https://site.example/map.xml?v=' + i)) };
  });
  const result = await discovery.discover(document(Array.from({ length: 300 }, (_, i) => '<a href="/item?page=' + i + '">Page</a>').join('')));
  assert.equal(result.urls.length, discovery.limits.maxUrls);
  assert.equal(calls.length, discovery.limits.maxSitemaps);
  assert.equal(result.skipped.length, discovery.limits.maxSkipped);
  assert.ok(result.skipped.some((entry) => entry.reason === 'sitemap-queue-limit'));
  assert.ok(result.skippedOmitted > 0);
  assert.equal(result.limitReached, true);
});
