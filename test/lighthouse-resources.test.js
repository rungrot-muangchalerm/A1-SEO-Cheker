const test = require('node:test');
const assert = require('node:assert/strict');
const website = require('../app/data/website.data');
const { stubTransport } = require('./helpers/transport');

test('Lighthouse auxiliary transport accepts missing-type text and bare 404 without weakening HTML MIME validation', async t => {
  stubTransport(t, [
    { status: 404, headers: { 'content-type': '' } },
    { html: '# Actual text', headers: { 'content-type': '' } },
    { html: '<title>Missing type</title>', headers: { 'content-type': '' } }
  ]);
  const missing = await website.fetchLighthouseAuditResource('https://site.example/llms.txt');
  assert.equal(missing.status, 404);
  assert.equal(missing.bytes, 0);
  assert.equal(missing.body.length, 0);
  const text = await website.fetchLighthouseAuditResource('https://site.example/llms.txt');
  assert.equal(text.body.toString('utf8'), '# Actual text');
  await assert.rejects(website.fetchPage('https://site.example/'), { code: 'UNSUPPORTED_TYPE' });
});

test('auxiliary redirects keep per-hop policy, origin, redirect limit and GET-only credential-free headers', async t => {
  const transport = stubTransport(t, [
    { status: 302, headers: { location: '/catalog.json' } }, { html: '{}', headers: { 'content-type': 'application/json' } },
    { status: 302, headers: { location: 'http://localhost:9999/secret' } },
    { status: 302, headers: { location: '/loop' } }, { status: 302, headers: { location: '/again' } }
  ]);
  const checked = [];
  const options = { scopeOrigin: 'https://site.example', beforeRequest: async url => checked.push(url.href) };
  const result = await website.fetchLighthouseAuditResource('https://site.example/llms.txt', options);
  assert.equal(result.finalUrl, 'https://site.example/catalog.json');
  assert.equal(result.redirects.length, 1);
  assert.deepEqual(checked, ['https://site.example/llms.txt', 'https://site.example/catalog.json']);
  await assert.rejects(website.fetchLighthouseAuditResource('https://site.example/llms.txt', options), { code: 'PORT_NOT_ALLOWED' });
  assert.equal(transport.calls.length, 3);
  await assert.rejects(website.fetchLighthouseAuditResource('https://site.example/llms.txt', { ...options, maxRedirects: 1 }), { code: 'TOO_MANY_REDIRECTS' });
  assert.ok(transport.calls.every(call => !call.options.headers.cookie && !call.options.headers.authorization && !call.options.method));
});

test('auxiliary streams retain byte caps, timeouts and abort-driven socket cleanup', async t => {
  const transport = stubTransport(t, [{ chunks: [Buffer.alloc(60)] }, { neverRespond: true }, { neverRespond: true }]);
  await assert.rejects(website.fetchLighthouseAuditResource('https://site.example/llms.txt', { maxBytes: 40 }), { code: 'RESPONSE_TOO_LARGE' });
  await assert.rejects(website.fetchLighthouseAuditResource('https://site.example/llms.txt', { timeoutMs: 25 }), { code: 'TIMEOUT' });
  const controller = new AbortController();
  const pending = website.fetchLighthouseAuditResource('https://site.example/llms.txt', { signal: controller.signal });
  const rejection = assert.rejects(pending, { code: 'CANCELLED' });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await rejection;
  assert.ok(transport.connections.every(connection => connection.destroyed));
});
