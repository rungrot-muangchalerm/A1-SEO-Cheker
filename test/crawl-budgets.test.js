const test = require('node:test');
const assert = require('node:assert/strict');
const timers = require('node:timers/promises');
const website = require('../app/data/website.data');
const audit = require('../app/service/audit.service');
const crawl = require('../app/service/crawl.service');
const { stubTransport } = require('./helpers/transport');

function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
  return (ms) => { now += ms; };
}

test('page-attempt budget includes root and failures; body cannot increase it', async (t) => {
  clock(t);
  const links = Array.from({ length: 25 }, (_, i) => '<a href="/page-' + i + '">Page</a>').join('');
  const transport = stubTransport(t, [{ status: 404 }, { html: '<title>Root</title>' + links }, { status: 404 },
    ...Array.from({ length: 25 }, (_, i) => ({ html: '<title>Page ' + i + '</title>' }))]);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true, maxPages: 1000 })).data;
  assert.equal(report.crawl.stats.attemptedPages, 20);
  assert.equal(report.pages.length, 20);
  assert.equal(report.coverage.discovered, 26);
  assert.equal(report.coverage.skipped.length, 6);
  assert.ok(report.coverage.skipped.every((entry) => entry.reason === 'CRAWL_PAGE_LIMIT'));
  assert.equal(report.coverage.limitReached, true);
  assert.equal(report.crawl.stopReason, 'CRAWL_PAGE_LIMIT');
  assert.equal(transport.calls.length, 22);
});

test('redirects cannot multiply the per-round request budget', async (t) => {
  clock(t);
  const links = Array.from({ length: 15 }, (_, i) => '<a href="/page-' + i + '">Page</a>').join('');
  const responses = [{ status: 404 }, { html: '<title>Root</title>' + links }, { status: 404 }];
  for (let i = 0; i < 15; i++) {
    for (let hop = 1; hop <= 5; hop++) responses.push({ status: 302, headers: { location: '/page-' + i + '-hop-' + hop } });
    responses.push({ html: '<title>Final ' + i + '</title>' });
  }
  const transport = stubTransport(t, responses);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  assert.equal(report.crawl.stats.requests, crawl.limits.maxRequests);
  assert.equal(transport.calls.length, crawl.limits.maxRequests);
  assert.equal(report.crawl.stopReason, 'CRAWL_REQUEST_LIMIT');
  assert.ok(report.coverage.skipped.some((entry) => entry.reason === 'CRAWL_REQUEST_LIMIT'));
  assert.equal(report.coverage.limitReached, true);
});

test('total retained HTML bytes are bounded in addition to per-response size', async (t) => {
  clock(t);
  const content = (links = '') => {
    const markup = '<title>Page</title>' + links;
    return markup + '<!--' + 'x'.repeat(website.limits.maxBytes - Buffer.byteLength(markup) - 7) + '-->';
  };
  const transport = stubTransport(t, [{ status: 404 }, { html: content('<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a><a href="/d">D</a>') },
    { status: 404 }, ...Array.from({ length: 4 }, () => ({ html: content() }))]);
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  assert.equal(report.pages.length, 4);
  assert.equal(report.crawl.stats.htmlBytes, crawl.limits.maxHtmlBytes);
  assert.equal(report.crawl.stopReason, 'CRAWL_BYTE_LIMIT');
  assert.equal(report.coverage.skipped[0].url, 'https://site.example/d');
  assert.equal(transport.calls.length, 6);
});

test('total deadline discloses remaining unexamined URLs and does not begin later requests', async (t) => {
  const advance = clock(t);
  const responses = [{ status: 404 }, { html: '<title>Root</title>' + Array.from({ length: 10 }, (_, i) => '<a href="/p-' + i + '">P</a>').join('') },
    { status: 404 }, ...Array.from({ length: 10 }, () => ({ html: '<title>Child</title>' }))];
  const transport = stubTransport(t, responses);
  const original = require('node:https').request;
  t.mock.method(require('node:https'), 'request', (...args) => { advance(10000); return original(...args); });
  const report = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  assert.equal(report.crawl.stopReason, 'CRAWL_DEADLINE');
  assert.equal(report.coverage.limitReached, true);
  assert.ok(report.coverage.skipped.length > 0);
  assert.equal(transport.calls.length, 6);
});
