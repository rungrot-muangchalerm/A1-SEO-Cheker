const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const websiteData = require('../app/data/website.data');
const auditService = require('../app/service/audit.service');

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

test('POST returns data for this request only; no stored-report GET exists', async (t) => {
  let calls = 0;
  t.mock.method(websiteData, 'fetchPage', async (url) => ({
    requestedUrl: url, finalUrl: url, status: 200, headers: { 'content-type': 'text/html' },
    html: '<title>Version ' + (++calls) + '</title>', bytes: 24, redirects: []
  }));
  const origin = await startApi(t);
  for (const version of [1, 2]) {
    const response = await fetch(origin + '/api/audits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/' })
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    const report = await response.json();
    assert.equal(report.status, 'partial');
    assert.equal(report.pages[0].html, '<title>Version ' + version + '</title>');
    assert.equal(report.auditId, undefined);
  }
  assert.equal((await fetch(origin + '/api/audits/anything')).status, 404);
  assert.equal(calls, 2);
});

test('invalid input and failures do not create example reports', async (t) => {
  for (const input of [null, [], {}, { url: 23 }]) {
    assert.deepEqual(await auditService.create(input), { ok: false, code: 'INVALID_URL' });
  }
  const origin = await startApi(t);
  const invalid = await fetch(origin + '/api/audits', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(invalid.status, 400);
  const failure = await invalid.json();
  assert.equal(failure.error, 'INVALID_URL');
  assert.equal(failure.status, 'failed');
  assert.equal(failure.schemaVersion, '1.0');
  const failed = await auditService.create({ url: 'file:///etc/passwd' });
  assert.deepEqual(failed, { ok: false, code: 'INVALID_URL' });
});
