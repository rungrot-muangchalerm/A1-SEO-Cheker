const test = require('node:test');
const assert = require('node:assert/strict');
const website = require('../app/data/website.data');
const { stubTransport } = require('./helpers/transport');

test('returns exact decoded HTML, final status, upstream headers and redirect evidence', async (t) => {
  const html = '<!doctype html><html lang="th"><title>\u0e17\u0e14\u0e2a\u0e2d\u0e1a</title><script>globalThis.__unexpectedAuditCode = true;</script></html>';
  const transport = stubTransport(t, [
    { status: 301, headers: { location: '/final?version=2' } },
    { status: 404, headers: { 'x-robots-tag': 'noindex', 'x-test': 'actual-header' }, html }
  ]);
  const result = await website.fetchPage('https://public.example/first?version=1#section');
  assert.equal(result.requestedUrl, 'https://public.example/first?version=1');
  assert.equal(result.finalUrl, 'https://public.example/final?version=2');
  assert.equal(result.status, 404);
  assert.equal(result.html, html);
  assert.equal(result.bytes, Buffer.byteLength(html));
  assert.equal(result.receivedBytes, Buffer.byteLength(html));
  assert.equal(result.headers['x-robots-tag'], 'noindex');
  assert.equal(result.headers['x-test'], 'actual-header');
  assert.deepEqual(result.redirects, [{
    url: 'https://public.example/first?version=1', status: 301,
    destination: 'https://public.example/final?version=2'
  }]);
  assert.deepEqual(transport.calls.map((call) => call.url), [result.requestedUrl, result.finalUrl]);
  assert.equal(globalThis.__unexpectedAuditCode, undefined);
});

test('decodes an HTTP-declared character set without changing markup', async (t) => {
  stubTransport(t, [{
    headers: { 'content-type': 'text/html; charset=windows-1252' },
    html: Buffer.from([0x3c, 0x70, 0x3e, 0x63, 0x61, 0x66, 0xe9, 0x3c, 0x2f, 0x70, 0x3e])
  }]);
  const page = await website.fetchPage('https://charset.example/');
  assert.equal(page.html, '<p>caf\u00e9</p>');
  assert.equal(page.bytes, 11);
});

test('follows every supported redirect status and respects relative URLs', async (t) => {
  const responses = [];
  for (const status of [301, 302, 303, 307, 308]) {
    responses.push({ status, headers: { location: '../final?keep=true' } }, { html: '<title>Final</title>' });
  }
  stubTransport(t, responses);
  for (const status of [301, 302, 303, 307, 308]) {
    const page = await website.fetchPage('https://redirect.example/folder/start');
    assert.equal(page.finalUrl, 'https://redirect.example/final?keep=true');
    assert.equal(page.redirects[0].status, status);
    assert.equal(page.html, '<title>Final</title>');
  }
});

test('sniffs declared HTML encoding and lets a BOM override an incorrect HTTP charset', async (t) => {
  const legacy = Buffer.concat([Buffer.from('<meta charset="windows-1252"><title>caf', 'ascii'), Buffer.from([0xe9]), Buffer.from('</title>', 'ascii')]);
  const utf8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('<title>\u0e44\u0e17\u0e22</title>', 'utf8')]);
  stubTransport(t, [
    { headers: { 'content-type': 'text/html' }, html: legacy },
    { headers: { 'content-type': 'text/html; charset=windows-1252' }, html: utf8 }
  ]);
  const first = await website.fetchPage('https://encoding.example/legacy');
  assert.equal(first.encoding, 'windows-1252');
  assert.ok(first.html.includes('caf\u00e9'));
  const second = await website.fetchPage('https://encoding.example/bom');
  assert.equal(second.encoding, 'UTF-8');
  assert.equal(second.html, '<title>\u0e44\u0e17\u0e22</title>');
});
