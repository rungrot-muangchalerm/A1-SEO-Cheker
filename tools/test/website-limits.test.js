const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns/promises');
const zlib = require('node:zlib');
const website = require('../../app/data/website.data');
const { stubTransport } = require('./helpers/transport');

test('caps slow headers, DNS resolution and total redirect time', async (t) => {
  const transport = stubTransport(t, [{ neverRespond: true }]);
  await assert.rejects(website.fetchPage('https://slow.example/', { timeoutMs: 25 }), { code: 'TIMEOUT' });
  assert.equal(transport.connections[0].destroyed, true);
  t.mock.method(dns, 'lookup', () => new Promise(() => {}));
  await assert.rejects(website.fetchPage('https://dns.example/', { timeoutMs: 25 }), { code: 'TIMEOUT' });
  assert.equal(transport.calls.length, 1);
});

test('limits advertised content length and chunked bodies', async (t) => {
  const transport = stubTransport(t, [
    { headers: { 'content-length': '1000' }, html: 'small' },
    { chunks: [Buffer.alloc(20), Buffer.alloc(20), Buffer.alloc(20)] }
  ]);
  await assert.rejects(website.fetchPage('https://large.example/', { maxBytes: 40 }), { code: 'RESPONSE_TOO_LARGE' });
  await assert.rejects(website.fetchPage('https://chunked.example/', { maxBytes: 40 }), { code: 'RESPONSE_TOO_LARGE' });
  assert.equal(transport.calls.length, 2);
  assert.equal(transport.connections[1].destroyed, true);
});

test('uses one deadline across redirect hops rather than resetting it per page', async (t) => {
  const transport = stubTransport(t, [
    { delay: 15, status: 302, headers: { location: '/next' } },
    { delay: 100, html: '<title>Too late</title>' }
  ]);
  await assert.rejects(website.fetchPage('https://slow-chain.example/', { timeoutMs: 60 }), { code: 'TIMEOUT' });
  assert.equal(transport.calls.length, 2);
  assert.equal(transport.connections[1].destroyed, true);
});

test('accepts supported compression and bounds decompressed bytes', async (t) => {
  const html = '<html><title>Compressed</title></html>';
  stubTransport(t, [
    { headers: { 'content-encoding': 'gzip' }, html: zlib.gzipSync(html) },
    { headers: { 'content-encoding': 'deflate' }, html: zlib.deflateSync(html) },
    { headers: { 'content-encoding': 'br' }, html: zlib.brotliCompressSync(html) },
    { headers: { 'content-encoding': 'gzip' }, html: zlib.gzipSync('x'.repeat(5000)) },
    { headers: { 'content-encoding': 'gzip' }, html: 'invalid gzip' }
  ]);
  for (const name of ['gzip', 'deflate', 'br']) {
    const page = await website.fetchPage('https://encoded.example/' + name);
    assert.equal(page.html, html);
    assert.equal(page.bytes, Buffer.byteLength(html));
    assert.ok(page.receivedBytes > 0);
  }
  await assert.rejects(website.fetchPage('https://encoded.example/oversized', { maxBytes: 200 }), { code: 'RESPONSE_TOO_LARGE' });
  await assert.rejects(website.fetchPage('https://encoded.example/corrupt'), { code: 'DECOMPRESSION_FAILED' });
});

test('rejects unsupported MIME types, encodings and character sets', async (t) => {
  stubTransport(t, [
    { headers: { 'content-type': 'application/pdf' } },
    { headers: { 'content-type': '' } },
    { headers: { 'content-encoding': 'unknown' } },
    { headers: { 'content-type': 'text/html; charset=invalid-charset' }, html: 'body' }
  ]);
  for (const code of ['UNSUPPORTED_TYPE', 'UNSUPPORTED_TYPE', 'UNSUPPORTED_ENCODING', 'UNSUPPORTED_CHARSET']) {
    await assert.rejects(website.fetchPage('https://type.example/'), { code });
  }
});

test('terminates redirect loops, excessive redirects and malformed redirects', async (t) => {
  const transport = stubTransport(t, [
    { status: 301, headers: { location: '/again' } },
    { status: 302, headers: { location: '/' } },
    { status: 302, headers: { location: '/next' } },
    { status: 302, headers: { location: '/third' } },
    { status: 302 },
    { status: 302, headers: { location: 'http://[' } }
  ]);
  await assert.rejects(website.fetchPage('https://loop.example/'), { code: 'REDIRECT_LOOP' });
  await assert.rejects(website.fetchPage('https://limited.example/', { maxRedirects: 1 }), { code: 'TOO_MANY_REDIRECTS' });
  await assert.rejects(website.fetchPage('https://missing.example/'), { code: 'INVALID_REDIRECT' });
  await assert.rejects(website.fetchPage('https://invalid.example/'), { code: 'INVALID_REDIRECT' });
  assert.equal(transport.calls.length, 6);
});

test('network errors and truncated streams return codes without raw upstream details', async (t) => {
  stubTransport(t, [{ networkError: true }, { streamError: true }]);
  for (let i = 0; i < 2; i++) {
    await assert.rejects(website.fetchPage('https://failed.example/'), (error) => error.code === 'NETWORK_ERROR' && !error.message.includes('Upstream'));
  }
});
