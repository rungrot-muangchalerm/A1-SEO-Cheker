const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../app/service/html.service');
const seo = require('../app/service/seo.service');

function analyze(source, headers = {}) {
  const page = { finalUrl: 'https://site.example/folder/page', html: source, headers, status: 200, redirects: [] };
  page.metadata = html.parse(page);
  return Object.fromEntries(seo.analyze(page).map((entry) => [entry.ruleId, entry]));
}

test('detects absent or whitespace-only title and description', () => {
  for (const source of ['', '<title> &nbsp; </title><meta name="description" content="  ">']) {
    const result = analyze(source);
    assert.equal(result['title-content'].outcome, 'fail');
    assert.equal(result['description-content'].outcome, 'fail');
    assert.equal(result['canonical-declaration'].outcome, 'review');
  }
});

test('valid metadata has evidence, while duplicate declarations require confirmation', () => {
  const source = '<title>Useful page</title><meta name="description" content="Useful description"><link rel="canonical" href="../main">';
  const result = analyze(source);
  assert.equal(result['title-content'].outcome, 'pass');
  assert.equal(result['description-content'].outcome, 'pass');
  assert.equal(result['canonical-declaration'].outcome, 'pass');
  assert.equal(result['canonical-declaration'].evidence[0].url, 'https://site.example/main');
  assert.equal(analyze(source + '<title>Second</title>')['title-content'].outcome, 'review');
  assert.equal(analyze(source + '<meta name="description" content="Different">')['description-content'].outcome, 'review');
});

test('rejects empty, invalid, credential-bearing and conflicting canonical declarations', () => {
  for (const target of ['', 'http://[', 'javascript:alert(1)', 'https://user:password@site.example/page']) {
    assert.equal(analyze('<link rel="canonical" href="' + target + '">')['canonical-declaration'].outcome, 'fail');
  }
  assert.equal(analyze('<link rel="canonical" href="/one"><link rel="canonical" href="/two">')['canonical-declaration'].outcome, 'fail');
  assert.equal(analyze('<link rel="canonical" href="/one"><link rel="canonical" href="https://site.example/one">')['canonical-declaration'].outcome, 'pass');
});

test('canonical header parser preserves commas in URIs and detects HTML/header conflicts', () => {
  const result = analyze('', { link: '<https://site.example/a,b>; rel="canonical"' });
  assert.equal(result['canonical-declaration'].outcome, 'pass');
  assert.equal(result['canonical-declaration'].evidence[0].kind, 'header');
  assert.equal(result['canonical-declaration'].evidence[0].url, 'https://site.example/a,b');
  assert.equal(analyze('<link rel="canonical" href="/one">', { link: '</two>; rel="canonical"' })['canonical-declaration'].outcome, 'fail');
  assert.equal(analyze('', { link: '<broken' })['canonical-declaration'].outcome, 'not-checked');
});

test('truncated metadata does not hide behind a passing result', () => {
  assert.equal(analyze('<meta name="x">'.repeat(5001))['description-content'].outcome, 'not-checked');
  assert.equal(analyze('<link rel="canonical" href="/one">'.repeat(5001))['canonical-declaration'].outcome, 'not-checked');
  assert.equal(analyze('<title>one</title>'.repeat(5001))['title-content'].outcome, 'not-checked');
});
