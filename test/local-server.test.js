const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const http = require('node:http');
const { start } = require('./helpers/local-server');

function request(origin, options = {}, body = '') {
  return new Promise((resolve, reject) => {
    const req = http.request(origin + (options.path || '/'), { ...options, agent: false, timeout: 1500 }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Connection timed out')));
    req.end(body);
  });
}

test('the actual framework entry starts on HTTP loopback, serves frontend/assets/API together and cannot be reached through a LAN interface', async (t) => {
  const server = await start(t);
  const home = await request(server.origin);
  assert.equal(home.status, 200);
  assert.ok(home.body.includes('export-json-button'));
  const assets = await request(server.origin, { path: '/assets/js/app.js' });
  assert.equal(assets.status, 200);
  assert.ok(assets.body.includes('fetch("/api/audits"'));
  const result = await request(server.origin, { path: '/api/audits', method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: server.origin } }, '{"url":"http://127.0.0.1/"}');
  assert.equal(result.status, 400);
  assert.equal(JSON.parse(result.body).error, 'PRIVATE_TARGET');
  assert.equal(result.headers['cache-control'], 'no-store');
  const addresses = Object.values(os.networkInterfaces()).flat().filter(entry => entry.family === 'IPv4' && !entry.internal);
  for (const entry of addresses) await assert.rejects(request('http://' + entry.address + ':' + server.port));
  assert.equal(server.logs().stderr, '');
});

test('untrusted Host/Origin/cross-site forms cannot invoke the local checker or leak input in errors/logs', async (t) => {
  const server = await start(t);
  for (const [headers, method, path, expected] of [
    [{ Host: 'attacker.example' }, 'GET', '/', 403],
    [{ Host: 'localhost:' + (server.port + 1) }, 'GET', '/', 403],
    [{ Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, 'POST', '/api/audits', 403],
    [{ Origin: 'null', 'Content-Type': 'application/json' }, 'POST', '/api/audits', 403],
    [{ 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' }, 'POST', '/api/audits', 403],
    [{ 'Content-Type': 'application/x-www-form-urlencoded' }, 'POST', '/api/audits', 415]
  ]) {
    const result = await request(server.origin, { headers, method, path }, method === 'POST' ? 'PRIVATE_MARKER_URL_AND_BODY' : '');
    assert.equal(result.status, expected);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.ok(!result.body.includes('PRIVATE_MARKER'));
  }
  const localhost = await request(server.origin, { headers: { Host: 'localhost:' + server.port } });
  assert.equal(localhost.status, 200);
  assert.ok(!JSON.stringify(server.logs()).includes('PRIVATE_MARKER'));
});
