const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const websiteData = require('../../app/data/website.data');
const auditService = require('../../app/service/audit.service');

async function startApi(t) {
  const app = express();
  app.use(express.json());
  app.use(require('../../app/routes/router'));
  app.use(require('../../app/middleware/audit.middleware').error);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  return 'http://127.0.0.1:' + server.address().port;
}

test('POST returns data for this request only; no stored-report GET exists', async (t) => {
  t.mock.method(websiteData, 'fetchRobots', async () => { throw new websiteData.WebsiteError('DNS_FAILED'); });
  let calls = 0;
  t.mock.method(websiteData, 'fetchPage', async (url) => ({
    requestedUrl: url, finalUrl: url, status: 200, headers: { 'content-type': 'text/html' },
    html: '<title>Version ' + (++calls) + '</title>', bytes: 24, redirects: []
  }));
  const origin = await startApi(t);
  for (const version of [1, 2]) {
    const response = await fetch(origin + '/api/audits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/', discover: false, crawl: false, render: false, lighthouse: false })
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    const report = await response.json();
    assert.equal(report.status, 'partial');
    assert.equal(report.pages[0].metadata.title, 'Version ' + version);
    assert.equal(report.pages[0].html, undefined);
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
  assert.equal(failure.schemaVersion, '2.0');
  const failed = await auditService.create({ url: 'file:///etc/passwd' });
  assert.deepEqual(failed, { ok: false, code: 'INVALID_URL' });
});

test('URL-only POST runs discovery, crawl, JavaScript and Lighthouse through one JSON or NDJSON request without storing a job', async t => {
  const { start } = require('./helpers/development-site');
  const { lhr, stubLighthouse } = require('./helpers/lighthouse');
  const site = await start(t);
  const engine = stubLighthouse(t, [0, 1].map(() => lhr({ requestedUrl: site.origin + '/', finalUrl: site.origin + '/' })));
  const origin = await startApi(t);
  for (const accept of ['application/json', 'application/x-ndjson']) {
    const response = await fetch(origin + '/api/audits', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify({ url: site.origin + '/' }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    let report;
    if (accept === 'application/json') {
      assert.match(response.headers.get('content-type'), /^application\/json/);
      report = await response.json();
    } else {
      assert.match(response.headers.get('content-type'), /^application\/x-ndjson/);
      const frames = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
      assert.ok(frames.some(frame => frame.type === 'progress'));
      assert.equal(frames.filter(frame => frame.type === 'report').length, 1);
      assert.equal(frames.at(-1).type, 'report');
      report = frames.at(-1).data;
    }
    assert.equal(report.scope.type, 'same-origin-crawl');
    assert.deepEqual(report.core_technical_checks.slice(0, 2).map(entry => entry.id), ['robots-file', 'sitemap-file']);
    assert.ok(report.core_technical_checks.slice(0, 2).every(entry => entry.status === 'found' && entry.evidence.length));
    assert.deepEqual(report.siteFiles.map(entry => entry.id), ['robots-file', 'sitemap-file']);
    assert.ok(report.siteFiles.every(entry => entry.status === 'found'));
    assert.equal(report.pages.length, 4);
    assert.ok(report.discovery.urls.some(entry => entry.url === site.origin + '/sitemap-only'));
    assert.ok(report.crawl.stats.attemptedPages >= 4);
    assert.equal(report.schemaVersion, '2.0');
    assert.ok(report.pages.every(page => page.html === undefined && page.metadata && page.checks.length && page.render));
    assert.ok(report.pages.every(page => !page.render.after || page.render.after.html === undefined));
    assert.ok(report.pages.every(page => page.render.reason !== 'not-requested'));
    assert.equal(report.lighthouse.categories.length, 4);
    assert.equal(report.lighthouse.reason, undefined);
    assert.ok(report.lighthouse.agentic);
    assert.ok(Array.isArray(report.issues) && Array.isArray(report.notChecked));
    assert.equal(report.auditId, undefined);
    assert.equal(report.history, undefined);
  }
  assert.equal(engine.calls.length, 2);
  assert.ok(engine.calls.every(call => call.url === site.origin + '/'));
  assert.equal((await fetch(origin + '/api/audits/history')).status, 404);
});

test('removed framework demo routes return JSON 404 and no demo modules are loaded', async t => {
  const origin = await startApi(t);
  for (const [method, path] of [['GET', '/api/user/get-demo'], ['POST', '/api/user/get-demo'], ['GET', '/api/user']]) {
    const response = await fetch(origin + path, { method });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(await response.json(), { error: 'Not Found', path });
  }
  const loaded = Object.keys(require.cache);
  assert.ok(!loaded.some(file => /[\\/]demo\.(controller|service)\.js$|[\\/]user[\\/]user\.routes\.js$/.test(file)));
});
