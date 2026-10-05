const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const websiteData = require('../app/data/website.data');

async function startApi(t) {
  const app = express();
  app.use(require('../app/middleware/local.middleware').only);
  app.use(express.json());
  app.use(require('../app/middleware/audit-admission.middleware').create());
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

test('successful same-URL audits fetch fresh documents without filesystem/database/cache writes or request logs', async t => {
  const fs = require('node:fs');
  const fsp = require('node:fs/promises');
  const { stubTransport } = require('./helpers/transport');
  const marker = 'PRIVATE_REPORT_CONTENT';
  const transport = stubTransport(t, [{ html: '<title>' + marker + ' first</title>' }, { status: 404 },
    { html: '<title>' + marker + ' second</title>' }, { status: 404 }]);
  const origin = await startApi(t);
  const writes = [];
  for (const [module, methods] of [[fs, ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'createWriteStream']],
    [fsp, ['writeFile', 'appendFile']]]) {
    for (const method of methods) t.mock.method(module, method, () => { writes.push(method); throw new Error('Unexpected report persistence'); });
  }
  const logs = [t.mock.method(console, 'log', () => {}), t.mock.method(console, 'error', () => {}), t.mock.method(console, 'warn', () => {})];
  const reports = [];
  for (let i = 0; i < 2; i++) {
    const response = await fetch(origin + '/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://fixture.example/?private=' + marker }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    reports.push(await response.json());
  }
  assert.equal(reports[0].pages[0].metadata.title, marker + ' first');
  assert.equal(reports[1].pages[0].metadata.title, marker + ' second');
  assert.equal(transport.calls.length, 4);
  assert.equal((await fetch(origin + '/api/audits')).status, 404);
  assert.equal((await fetch(origin + '/api/audits/previous')).status, 404);
  assert.deepEqual(writes, []);
  assert.ok(logs.every(log => log.mock.calls.length === 0));
  const loaded = Object.keys(require.cache);
  assert.ok(!loaded.some(file => /[\\/]mysqli\.config\.js$|[\\/]node-cache[\\/]/.test(file)));
});
