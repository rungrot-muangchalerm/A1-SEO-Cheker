const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns/promises');
const express = require('express');

const good = fs.readFileSync(path.join(__dirname, 'fixtures/seo-good.html'), 'utf8');
const bad = fs.readFileSync(path.join(__dirname, 'fixtures/seo-bad.html'), 'utf8');

async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  return 'http://127.0.0.1:' + server.address().port;
}

async function fixtureApi(t) {
  const fixture = { html: good, status: 200, headers: {} };
  const requests = [];
  const upstream = await listen(t, http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('User-agent: *\nDisallow: /bad\nSitemap: https://fixture.example/sitemap.xml');
      return;
    }
    res.writeHead(fixture.status, { 'Content-Type': 'text/html; charset=utf-8', ...fixture.headers });
    res.end(fixture.html);
  }));
  t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  // Only this test adapter connects a vetted fixture hostname to its local server.
  // Production never accepts local destinations or a caller-provided DNS override.
  t.mock.method(https, 'request', (url, options, callback) =>
    http.request(upstream + url.pathname + url.search, { ...options, lookup: undefined }, callback)
  );
  const app = express();
  app.use(express.json());
  app.use(require('../app/routes/router'));
  app.use(require('../app/middleware/audit.middleware').error);
  const api = await listen(t, http.createServer(app));
  const audit = async (url) => {
    const response = await fetch(api + '/api/audits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    return response.json();
  };
  return { fixture, requests, audit };
}

test('real HTTP fixture content and headers produce passing and problematic API reports', async (t) => {
  const { fixture, requests, audit } = await fixtureApi(t);
  const passing = await audit('https://fixture.example/good');
  assert.equal(passing.pages[0].metadata.title, 'Workshop Schedule | Sample Studio');
  assert.equal(passing.pages[0].metadata.headings.length, 2);
  assert.equal(passing.pages[0].metadata.links[0].url, 'https://fixture.example/registration?session=2');
  assert.equal(passing.pages[0].analysisStatus, 'complete');
  assert.deepEqual(passing.issues, []);
  assert.equal(passing.summary.checks.pass, 8);
  fixture.html = bad;
  fixture.status = 404;
  fixture.headers = { 'X-Robots-Tag': ['otherbot: index', 'googlebot: nofollow'] };
  const failing = await audit('https://fixture.example/bad');
  assert.equal(failing.pages[0].status, 404);
  assert.deepEqual(failing.summary.checks, { pass: 0, fail: 5, review: 3, notChecked: 0 });
  assert.equal(failing.summary.critical, 1);
  assert.equal(failing.summary.warning, 4);
  assert.equal(failing.summary.review, 3);
  assert.equal(failing.issues.length, 8);
  const alt = failing.issues.find((entry) => entry.ruleId === 'image-alt');
  assert.equal(alt.details.missingAlt, 1);
  assert.equal(alt.details.emptyAlt, 1);
  const robots = failing.issues.find((entry) => entry.ruleId === 'robots-crawling');
  assert.equal(robots.evidence[0].rules[0].source, 'Disallow: /bad');
  assert.deepEqual(requests, ['/good', '/robots.txt', '/bad', '/robots.txt']);
  assert.equal(globalThis.__auditFixtureScriptRan, undefined);
  assert.equal(failing.lighthouse.status, 'not-checked');
});

test('changing bytes on the same URL changes the next round and never reuses a prior report', async (t) => {
  const { fixture, audit } = await fixtureApi(t);
  const first = await audit('https://fixture.example/good');
  fixture.html = bad;
  const second = await audit('https://fixture.example/good');
  assert.notEqual(first.pages[0].html, second.pages[0].html);
  assert.equal(second.pages[0].metadata.title, '');
  assert.ok(second.issues.some((entry) => entry.ruleId === 'title-content'));
  assert.equal(second.summary.critical, 0);
  assert.equal(second.auditId, undefined);
  assert.equal(second.history, undefined);
  assert.equal(first.issues.length, 0);
});

test('headers alone can add or remove a finding without substituting mock scores', async (t) => {
  const { fixture, audit } = await fixtureApi(t);
  fixture.headers = { 'X-Robots-Tag': 'Googlebot: noindex' };
  const first = await audit('https://fixture.example/good');
  assert.ok(first.issues.some((entry) => entry.ruleId === 'robots-indexing'));
  fixture.headers = { 'X-Robots-Tag': 'otherbot: noindex' };
  const second = await audit('https://fixture.example/good');
  assert.deepEqual(second.issues, []);
  assert.deepEqual(second.lighthouse.categories, []);
});
