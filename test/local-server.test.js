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
    headers: { 'Content-Type': 'application/json', Origin: server.origin } }, '{"url":"http://10.0.0.1/"}');
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

test('server environment remains private across real frontend/static/error responses and .env cannot be downloaded or tracked', async (t) => {
  const { execFileSync } = require('node:child_process');
  const secret = 'PRIVATE_SERVER_KEY_MUST_NOT_LEAK';
  const server = await start(t, { PRIVATE_TEST_SECRET: secret });
  for (const path of ['/', '/assets/js/app.js', '/.env', '/example.env', '/app/service/lighthouse.service.js', '/api/audits/old']) {
    const result = await request(server.origin, { path });
    assert.ok(!result.body.includes(secret));
    if (path.startsWith('/.') || path.startsWith('/app/') || path === '/example.env') assert.equal(result.status, 404);
  }
  const rejected = await request(server.origin, { path: '/api/audits', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ url: 'http://10.0.0.1/', lighthouse: true }));
  assert.equal(rejected.status, 400);
  assert.ok(!rejected.body.includes(secret));
  assert.ok(!JSON.stringify(server.logs()).includes(secret));
  assert.equal(execFileSync('git', ['ls-files', '.env'], { encoding: 'utf8' }).trim(), '');
  assert.equal(execFileSync('git', ['check-ignore', '.env'], { encoding: 'utf8' }).trim(), '.env');
});

test('real entry parser failures never write private request bytes to stdout/stderr or cacheable responses', async t => {
  const server = await start(t);
  const marker = 'PRIVATE_URL_HTML_REPORT';
  for (const [path, body, expected] of [
    ['/api/audits', '{"url":"https://fixture.example/' + marker + '"', 400],
    ['/API/AUDITS/', '{"url":"' + marker.repeat(7000) + '"}', 413],
    ['/api/audits/', '{"url":"http://10.0.0.1/?' + marker + '"}', 400]
  ]) {
    const response = await request(server.origin, { path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, body);
    assert.equal(response.status, expected);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['set-cookie'], undefined);
    assert.ok(!response.body.includes(marker));
    assert.ok(!response.body.includes('SyntaxError'));
  }
  assert.ok(!JSON.stringify(server.logs()).includes(marker));
  assert.equal(server.logs().stderr, '');
});

test('restarting the actual entry restores no successful fixture report and resets only transient admission counters', async t => {
  const path = require('node:path');
  const preload = { NODE_OPTIONS: '--require="' + path.join(__dirname, 'helpers/entry-fixture.cjs').replace(/\\/g, '/') + '"' };
  const first = await start(t, preload);
  const headers = { 'Content-Type': 'application/json' };
  const response = await request(first.origin, { path: '/api/audits', method: 'POST', headers }, '{"url":"https://fixture.example/"}');
  assert.equal(response.status, 200);
  const result = JSON.parse(response.body);
  assert.equal(result.pages[0].metadata.title, 'PRIVATE_RESTART_FIXTURE');
  for (let i = 0; i < 9; i++) {
    assert.equal((await request(first.origin, { path: '/api/audits', method: 'POST', headers }, '{}')).status, 400);
  }
  assert.equal((await request(first.origin, { path: '/api/audits', method: 'POST', headers }, '{}')).status, 429);
  await first.stop();
  const second = await start(t, preload);
  const home = await request(second.origin);
  assert.equal(home.status, 200);
  assert.ok(!home.body.includes('PRIVATE_RESTART_FIXTURE'));
  assert.ok(!home.body.includes('https://fixture.example/'));
  for (const path of ['/api/audits', '/api/audits/previous']) {
    const unavailable = await request(second.origin, { path });
    assert.equal(unavailable.status, 404);
    assert.equal(unavailable.headers['cache-control'], 'no-store');
    assert.ok(!unavailable.body.includes('PRIVATE_RESTART_FIXTURE'));
  }
  assert.equal((await request(second.origin, { path: '/api/audits', method: 'POST', headers }, '{}')).status, 400);
  assert.ok(!JSON.stringify(first.logs()).includes('PRIVATE_RESTART_FIXTURE'));
  assert.ok(!JSON.stringify(second.logs()).includes('PRIVATE_RESTART_FIXTURE'));
  assert.equal(first.logs().stderr, '');
  assert.equal(second.logs().stderr, '');
});
