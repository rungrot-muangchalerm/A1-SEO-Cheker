const test = require('node:test');
const assert = require('node:assert/strict');
const timers = require('node:timers/promises');
const html = require('../../app/service/html.service');
const structured = require('../../app/service/structured-data.service');
const audit = require('../../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan } = require('./helpers/frontend');

const base = 'https://site.example/';
const script = (value, type = 'application/ld+json') => '<script type="' + type + '">' + value + '</script>';
const markup = (extra = '', path = '/') => '<title>Root</title><meta name="description" content="Root description"><link rel="canonical" href="' + path + '">' + extra;
function page(extra) {
  const result = { finalUrl: base, html: markup(extra), headers: {} };
  result.metadata = html.parse(result);
  return result;
}
const rules = (report) => report.pages.flatMap((entry) => entry.checks).filter((entry) => entry.ruleId === 'jsonld-syntax');
function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
}

test('reads head/body JSON-LD as exact raw-text JSON with positions; graph and arrays pass syntax only, without context expansion or rich-result claims', () => {
  const input = page(script('{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"A &amp; B"}]}', ' Application/LD+JSON; charset=utf-8 ') +
    '<body>' + script('[{"@type":["Person","Thing"]}]') + '</body>');
  const result = structured.analyze(input);
  assert.equal(result.length, 2);
  assert.ok(result.every((entry) => entry.outcome === 'pass' && entry.complete));
  assert.equal(result[0].details.scope, 'json-syntax-only');
  assert.equal(result[0].details.jsonLdProcessing, 'not-performed');
  assert.equal(result[0].details.richResults, 'not-checked');
  assert.deepEqual(result[0].details.observedLiteralTypes, ['Organization']);
  assert.deepEqual(result[1].details.observedLiteralTypes, ['Person', 'Thing']);
  assert.ok(input.metadata.jsonLd.scripts[0].content.includes('A &amp; B'));
  assert.ok(result.every((entry) => entry.evidence[0].location.startLine && entry.evidence[0].sourceFormat === 'serialized-html'));
});

test('empty/malformed JSON, trailing commas, comments and HTML entity quotes are not silently repaired or executed', () => {
  for (const value of ['', '{"name":"x",}', '{// comment\n"name":"x"}', '{&quot;name&quot;:&quot;x&quot;}', 'globalThis.__jsonldExecuted=true']) {
    const result = structured.analyze(page(script(value)))[0];
    assert.equal(result.outcome, 'fail');
    assert.equal(result.severity, 'warning');
    assert.equal(result.details.syntax, 'invalid');
    assert.equal(result.complete, true);
  }
  assert.equal(globalThis.__jsonldExecuted, undefined);
});

test('absence and ordinary JS/JSON scripts are not mandatory structured-data failures; scalar JSON requires shape confirmation and literal types are not semantic validation', () => {
  assert.deepEqual(structured.analyze(page(script('{"x":1}', 'application/json') + script('globalThis.__jsonldExecuted=true', 'text/javascript'))), []);
  for (const value of ['null', '123', '"text"', 'true']) assert.equal(structured.analyze(page(script(value)))[0].outcome, 'review');
  const literal = structured.analyze(page(script('{"@context":{"alias":"@type","@type":"@id"},"@type":123}')))[0];
  assert.equal(literal.details.syntax, 'valid');
  assert.equal(literal.details.jsonLdProcessing, 'not-performed');
  assert.deepEqual(literal.details.observedLiteralTypes, []);
});

test('script count, UTF-8 byte/total caps and deep or wide structures disclose unavailable coverage, never parse truncated prefixes as syntax errors', () => {
  const many = page(script('{}').repeat(51));
  assert.equal(many.metadata.jsonLd.count, 51);
  assert.equal(many.metadata.jsonLd.scripts.length, structured.limits.maxScripts);
  assert.equal(structured.analyze(many).at(-1).reason, 'jsonld-extraction-limit');
  const huge = page(script(JSON.stringify({ name: '\u0e01'.repeat(45000) })));
  const failedSize = structured.analyze(huge)[0];
  assert.equal(failedSize.outcome, 'not-checked');
  assert.equal(failedSize.reason, 'jsonld-script-size');
  assert.equal(failedSize.details.syntax, 'not-checked');
  assert.equal(huge.metadata.jsonLd.scripts[0].content, null);
  const total = page(script(JSON.stringify({ name: 'x'.repeat(120000) })).repeat(5));
  assert.ok(total.metadata.jsonLd.bytes <= structured.limits.maxTotalBytes);
  assert.equal(structured.analyze(total).at(-2).reason, 'jsonld-total-size');
  const deep = structured.analyze(page(script('['.repeat(70) + '{}' + ']'.repeat(70))))[0];
  assert.equal(deep.outcome, 'not-checked');
  assert.equal(deep.details.syntax, 'valid');
  assert.equal(deep.reason, 'jsonld-structure-limit');
  const wide = structured.analyze(page(script(JSON.stringify(Array.from({ length: 10001 }, () => 1)))))[0];
  assert.equal(wide.reason, 'jsonld-structure-limit');
});

test('remote context, imports, IDs and prototype-like keys never cause network loads, execution or shared state mutation', async (t) => {
  const transport = stubTransport(t, [{ html: markup(script('{"@context":{"@import":"http://127.0.0.1/context"},"@id":"http://127.0.0.1/target","__proto__":{"polluted":true}}')) }, { status: 404 }]);
  const report = (await audit.create({ url: base })).data;
  assert.equal(rules(report)[0].details.syntax, 'valid');
  assert.equal(transport.calls.length, 2);
  assert.ok(transport.calls.every((entry) => new URL(entry.url).origin === 'https://site.example'));
  assert.equal({}.polluted, undefined);
  assert.ok(report.notChecked.some((entry) => entry.id === 'jsonld-semantics'));
  assert.deepEqual(report.lighthouse.categories, []);
});

test('actual changed JSON bytes create different current findings and issue counters without reusing an old report', async (t) => {
  stubTransport(t, [{ html: markup(script('{"@context":"https://schema.org","@type":"Thing"}')) }, { status: 404 },
    { html: markup(script('{"name":"x",}')) }, { status: 404 }]);
  const first = (await audit.create({ url: base })).data;
  const second = (await audit.create({ url: base })).data;
  assert.deepEqual(first.issues.map(entry => entry.ruleId), ['open-graph']);
  assert.equal(second.issues.length, 2);
  assert.equal(second.summary.warning, 1);
  assert.equal(second.issues[0].ruleId, 'jsonld-syntax');
  assert.equal(rules(first)[0].outcome, 'pass');
  assert.equal(rules(second)[0].outcome, 'fail');
});

test('multiple JSON-LD blocks keep unique rule-instance IDs on each crawled page, without changing HTTP or page counts', async (t) => {
  clock(t);
  const transport = stubTransport(t, [{ status: 404 }, { html: markup(script('{bad}') + script('{worse}') + '<a href="/next">Next</a>') },
    { status: 404 }, { html: markup(script('{}') + script('{broken}'), '/next') }]);
  const report = (await audit.create({ url: base, crawl: true })).data;
  const json = rules(report);
  assert.equal(report.pages.length, 2);
  assert.equal(transport.calls.length, 4);
  assert.equal(json.length, 4);
  assert.equal(new Set(json.map((entry) => entry.id)).size, 4);
  assert.equal(report.issues.filter((entry) => entry.ruleId === 'jsonld-syntax').length, 3);
  assert.ok(json.some((entry) => entry.id === 'jsonld-syntax:2:' + base));
});

test('browser opens the exact failed block, escapes script evidence, exports it manually and clears JSON-LD on refresh', async (t) => {
  stubTransport(t, [{ html: markup(script('{"name":"<img src=x onerror=globalThis.__jsonldXss=true>"}') + script('{"second":"proof",}')) }, { status: 404 }]);
  const { page: browserPage, errors } = await frontend(t, { width: 390, height: 844 });
  await scan(browserPage, base);
  await browserPage.locator('[data-issue-id="jsonld-syntax:2"]').click();
  assert.ok((await browserPage.locator('#detail-content').textContent()).includes('second'));
  assert.ok((await browserPage.locator('#detail-content').textContent()).includes('rich results'));
  assert.equal(await browserPage.locator('#detail-content script').count(), 0);
  assert.equal(await browserPage.locator('#detail-content img').count(), 0);
  assert.equal(await browserPage.evaluate(() => globalThis.__jsonldXss), undefined);
  assert.equal(await browserPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await browserPage.locator('#issue-drawer .btn-close').click();
  await browserPage.locator('#issue-drawer').waitFor({ state: 'hidden' });
  const [download] = await Promise.all([browserPage.waitForEvent('download'), browserPage.locator('#export-button').click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(exported.issues.some(issue => issue.ruleId === 'jsonld-syntax' && JSON.stringify(issue.evidence).includes('second')));
  await browserPage.reload();
  assert.equal(await browserPage.locator('#website-url').inputValue(), '');
  assert.equal(await browserPage.locator('#detail-content').textContent(), '');
  assert.deepEqual(errors, []);
});
