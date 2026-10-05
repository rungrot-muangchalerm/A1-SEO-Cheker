const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const html = require('../app/service/html.service');
const audit = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');

const base = 'https://site.example/';
const meta = (property, content) => '<meta property="' + property + '" content="' + content + '">';
const markup = (extra = '') => '<title>Root</title><meta name="description" content="Root description"><link rel="canonical" href="/">' + extra;
const og = () => meta('og:title', 'Share title') + meta('og:type', 'website') + meta('og:image', 'http://127.0.0.1/private-image') +
  meta('og:description', '&lt;img src=x onerror=&quot;globalThis.__ogXss=true&quot;&gt;') + meta('og:url', base);

test('observed sharing fields retain order, repeated/structured properties, actual HTML positions and resolved URLs without becoming SEO rules', () => {
  const page = { finalUrl: base, html: markup('<base href="/catalog/">' + meta('OG:TITLE', 'A &amp; B') + meta('og:image', 'first.jpg') +
    meta('og:image:width', '400') + meta('og:image', 'second.jpg') + meta('og:image:height', '300') + '<meta name="og:title" content="Name-only">') };
  const info = html.parse(page).openGraph;
  assert.equal(info.observedCount, 5);
  assert.equal(info.complete, true);
  assert.deepEqual(info.entries.map((entry) => entry.property), ['og:title', 'og:image', 'og:image:width', 'og:image', 'og:image:height']);
  assert.equal(info.entries[0].content, 'A & B');
  assert.equal(info.entries[1].resolvedUrl, base + 'catalog/first.jpg');
  assert.equal(info.entries[3].resolvedUrl, base + 'catalog/second.jpg');
  assert.ok(info.entries.every((entry) => entry.sourceUrl === base && entry.location.startLine && entry.sourceFormat === 'serialized-html'));
  assert.equal(info.scope, 'initial-html-sharing-metadata');
});

test('present, missing, empty or invalid-looking Open Graph stays informational, never affects SEO issues or fabricates scores or requests', async (t) => {
  const values = [og(), '', meta('og:title', '') + meta('og:image', 'javascript:alert(1)')];
  const transport = stubTransport(t, values.flatMap((value) => [{ html: markup(value) }, { status: 404 }]));
  const reports = [];
  for (const value of values) reports.push((await audit.create({ url: base })).data);
  assert.ok(reports.every((report) => report.issues.length === 0 && report.summary.warning === 0 && report.summary.review === 0));
  assert.deepEqual(reports.map((report) => report.summary.checks), [reports[0].summary.checks, reports[0].summary.checks, reports[0].summary.checks]);
  assert.equal(reports[1].pages[0].metadata.openGraph.observedCount, 0);
  assert.equal(reports[2].pages[0].metadata.openGraph.entries[1].resolvedUrl, null);
  assert.ok(reports.every((report) => report.lighthouse.categories.length === 0));
  assert.equal(transport.calls.length, 6);
  assert.ok(transport.calls.every((entry) => new URL(entry.url).origin === 'https://site.example'));
});

test('OG/metadata caps disclose incomplete observations rather than claiming all sharing properties were absent or examined', async (t) => {
  const many = html.parse({ finalUrl: base, html: markup(meta('og:title', 'Repeated').repeat(105)) }).openGraph;
  assert.equal(many.entries.length, 100);
  assert.equal(many.observedCount, 105);
  assert.equal(many.complete, false);
  stubTransport(t, [{ html: markup('<meta name="irrelevant" content="x">'.repeat(5000) + meta('og:title', 'Beyond metadata cap')) }, { status: 404 }]);
  const report = (await audit.create({ url: base })).data;
  const info = report.pages[0].metadata.openGraph;
  assert.equal(info.complete, false);
  assert.equal(info.entries.length, 0);
  assert.ok(report.notChecked.some((entry) => entry.id === 'open-graph' && entry.reason === 'metadata-limit'));
  assert.ok(!report.issues.some((entry) => entry.ruleId === 'open-graph'));
});

test('desktop/mobile page details show sharing values and source proof as escaped text, without fetching private media or overflowing', async (t) => {
  const transport = stubTransport(t, [{ html: markup(og() + meta('og:site_name', 'Long'.repeat(500))) }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await scan(page, base);
  await page.locator('#pages-tab').click();
  await page.locator('[data-page-url="' + base + '"]').first().click();
  await page.waitForFunction(() => {
    const drawer = document.getElementById('issue-drawer');
    return drawer.classList.contains('show') && !drawer.classList.contains('showing');
  });
  const section = page.locator('[data-open-graph]');
  assert.ok((await section.textContent()).includes('Share title'));
  assert.ok((await section.textContent()).includes('http://127.0.0.1/private-image'));
  assert.equal(await section.locator('[data-og-property="og:image"] img').count(), 0);
  assert.equal(await section.locator('img, script, iframe, a').count(), 0);
  assert.equal(await page.evaluate(() => globalThis.__ogXss), undefined);
  assert.ok(!requests.some((url) => url.includes('private-image')));
  assert.equal(transport.calls.length, 2);
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const bounds = document.getElementById('issue-drawer').getBoundingClientRect();
      return Math.abs(bounds.right - innerWidth) < 1 && bounds.left >= 0 && bounds.width <= innerWidth;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok((await section.locator('[data-og-property="og:site_name"]').textContent()).includes('\u0e41\u0e2a\u0e14\u0e07\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19'));
    if (process.env.SEO_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-og-' + name + '.png'), fullPage: false });
  }
  await section.locator('[data-og-property="og:title"] summary').click();
  assert.ok((await section.locator('[data-og-property="og:title"] pre').textContent()).includes('<meta property="og:title"'));
  assert.deepEqual(errors, []);
});

test('replacement and refresh remove old sharing fields; absent OG leaves issue/export counts unchanged', async (t) => {
  stubTransport(t, [{ html: markup(og()) }, { status: 404 }, { html: markup() }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  await scan(page, base);
  await page.locator('#pages-tab').click();
  await page.locator('[data-page-url="' + base + '"]').first().click();
  assert.ok((await page.locator('[data-open-graph]').textContent()).includes('Share title'));
  await page.locator('#issue-drawer .btn-close').click();
  await page.locator('#issue-drawer').waitFor({ state: 'hidden' });
  await scan(page, base);
  await page.locator('#pages-tab').click();
  await page.locator('[data-page-url="' + base + '"]').first().click();
  assert.equal(await page.locator('[data-og-property]').count(), 0);
  assert.ok(!(await page.locator('[data-open-graph]').textContent()).includes('Share title'));
  assert.equal(await page.locator('#export-button').isDisabled(), true);
  await page.reload();
  assert.equal(await page.locator('#detail-content').textContent(), '');
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.deepEqual(errors, []);
});
