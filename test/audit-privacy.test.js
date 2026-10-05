const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const websiteData = require('../app/data/website.data');

async function startApi(t) {
  const app = express();
  app.use(express.json());
  app.use(require('../app/routes/router'));
  app.use(require('../app/middleware/audit.middleware').error);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  return 'http://127.0.0.1:' + server.address().port;
}

test('parser errors, failed requests and unknown reports are not cached or logged', async (t) => {
  const errorLog = t.mock.method(console, 'error', () => {});
  const normalLog = t.mock.method(console, 'log', () => {});
  const origin = await startApi(t);
  const marker = 'PRIVATE_INPUT_MUST_NOT_APPEAR';
  for (const item of [
    { body: '{"url":"https://example.com/' + marker + '"', code: 'INVALID_JSON', status: 400 },
    { body: '{"url":"' + marker.repeat(6000) + '"}', code: 'BODY_TOO_LARGE', status: 413 }
  ]) {
    const response = await fetch(origin + '/api/audits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: item.body
    });
    assert.equal(response.status, item.status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    const body = await response.text();
    assert.equal(body.includes(marker), false);
    assert.equal(JSON.parse(body).error, item.code);
  }
  t.mock.method(websiteData, 'fetchPage', async () => {
    const error = new Error(marker);
    error.code = marker;
    throw error;
  });
  const failed = await fetch(origin + '/api/audits', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"url":"https://example.com"}'
  });
  assert.equal(failed.status, 500);
  assert.equal((await failed.text()).includes(marker), false);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
  const unknown = await fetch(origin + '/api/audits/old-report');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get('cache-control'), 'no-store');
  assert.equal(errorLog.mock.calls.length, 0);
  assert.equal(normalLog.mock.calls.length, 0);
});

test('unsupported request encoding is reported without parser internals', async (t) => {
  const errorLog = t.mock.method(console, 'error', () => {});
  const origin = await startApi(t);
  const response = await fetch(origin + '/api/audits', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=unsupported-charset' }, body: '{}'
  });
  assert.equal(response.status, 415);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).error, 'UNSUPPORTED_REQUEST_ENCODING');
  assert.equal(errorLog.mock.calls.length, 0);
});
