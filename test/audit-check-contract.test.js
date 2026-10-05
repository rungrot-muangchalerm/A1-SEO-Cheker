const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../app/service/html.service');
const seo = require('../app/service/seo.service');

test('every real check has stable identity, context, action and authoritative references', () => {
  for (const source of ['', '<title>Page</title><meta name="description" content="Description"><meta name="robots" content="noindex"><link rel="canonical" href="/main"><img src="/image.jpg">']) {
    const page = { finalUrl: 'https://site.example/page', status: 200, headers: {}, html: source, redirects: [] };
    page.metadata = html.parse(page);
    const checks = seo.analyze(page);
    assert.equal(new Set(checks.map((entry) => entry.ruleId)).size, checks.length);
    for (const entry of checks) {
      assert.ok(entry.id);
      assert.equal(entry.id, entry.ruleId);
      assert.equal(entry.ruleVersion, '1.0');
      assert.equal(entry.url, page.finalUrl);
      assert.deepEqual(entry.urls, [page.finalUrl]);
      assert.ok(entry.title && entry.found && entry.impact);
      assert.ok(entry.steps.length && entry.steps.every((step) => typeof step === 'string' && step.trim()));
      assert.ok(entry.evidence.length);
      for (const item of entry.evidence) {
        assert.ok(item.kind);
        assert.ok(item.sourceUrl);
        if (item.kind === 'html') assert.equal(item.sourceFormat, 'serialized-html');
        assert.equal(item.repositoryFile, undefined);
      }
      for (const reference of entry.references) {
        const url = new URL(reference.url);
        assert.equal(url.protocol, 'https:');
        assert.ok(['developers.google.com', 'www.w3.org'].includes(url.hostname));
        assert.ok(reference.title);
      }
    }
  }
});

test('negative evidence names the observed surface instead of fabricating markup', () => {
  const page = { finalUrl: 'https://site.example/page', status: 200, headers: {}, html: '', redirects: [] };
  page.metadata = html.parse(page);
  const title = seo.analyze(page).find((entry) => entry.ruleId === 'title-content');
  assert.deepEqual(title.evidence, [{
    sourceUrl: page.finalUrl, kind: 'observation', selector: 'head > title', count: 0, complete: true
  }]);
  assert.equal(title.evidence[0].source, undefined);
});

test('robots evidence refers to the robots file, not an invented repository location', () => {
  const page = { finalUrl: 'https://site.example/private', status: 200, headers: {}, html: '', redirects: [],
    robots: { kind: 'robots', url: 'https://site.example/robots.txt', status: 'checked', googlebotAllowed: false,
      rules: [{ agent: 'Googlebot', line: 2, source: 'Disallow: /private' }] }
  };
  page.metadata = html.parse(page);
  const entry = seo.analyze(page).find((check) => check.ruleId === 'robots-crawling');
  assert.equal(entry.evidence[0].sourceUrl, page.robots.url);
  assert.equal(entry.evidence[0].rules[0].line, 2);
});
