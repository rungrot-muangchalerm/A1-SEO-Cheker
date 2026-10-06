const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const admission = require('../app/middleware/audit-admission.middleware');
const service = require('../app/service/audit.service');
const { start } = require('./helpers/local-server');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function api(t) {
  const app = express();
  app.use(express.json());
  app.use(admission.create());
  app.use(require('../app/routes/router'));
  app.use(require('../app/middleware/audit.middleware').error);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return 'http://127.0.0.1:' + server.address().port;
}

function post(origin, path = '/api/audits') {
  return fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://fixture.example/PRIVATE_MARKER', maxConcurrent: 1000, maxStarts: 1000 }) });
}

test('active admission includes disconnected work until cleanup settles, rejects without starting work and releases on failure', async t => {
  const firstStarted = deferred();
  const cancelled = deferred();
  const cleanup = deferred();
  const secondStarted = deferred();
  const second = deferred();
  let count = 0;
  t.mock.method(service, 'create', async (_body, options) => {
    count += 1;
    if (count === 1) {
      options.signal.addEventListener('abort', () => cancelled.resolve(), { once: true });
      firstStarted.resolve();
      await cleanup.promise;
      return { ok: false, code: 'CANCELLED' };
    }
    if (count === 2) { secondStarted.resolve(); await second.promise; }
    throw new Error('PRIVATE_MARKER');
  });
  const origin = await api(t);
  const client = http.request(origin + '/api/audits', { method: 'POST', agent: false, headers: { 'Content-Type': 'application/json' } });
  client.on('error', () => {});
  client.end('{"url":"https://fixture.example/"}');
  await firstStarted.promise;
  const pending = post(origin, '/API/AUDITS/');
  await secondStarted.promise;
  client.destroy();
  await cancelled.promise;
  for (let i = 0; i < 2; i++) {
    const busy = await post(origin);
    assert.equal(busy.status, 503);
    assert.equal(busy.headers.get('retry-after'), '1');
    assert.equal(busy.headers.get('cache-control'), 'no-store');
    const body = await busy.json();
    assert.equal(body.error, 'AUDIT_BUSY');
    assert.ok(!JSON.stringify(body).includes('PRIVATE_MARKER'));
    assert.equal(count, 2);
  }
  cleanup.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await post(origin)).status, 500);
  assert.equal(count, 3);
  second.resolve();
  assert.equal((await pending).status, 500);
  assert.equal((await post(origin)).status, 500);
  assert.equal(count, 4);
});

test('completed requests count toward a bounded start window; non-audit routes do not, and elapsed windows/reset instances hold no reports', () => {
  const run = admission.create();
  const make = (method = 'POST', path = '/api/audits') => ({ method, path });
  const response = () => ({ set() { return this; }, status(value) { this.code = value; return this; }, json(body) { this.body = body; return this; } });
  let admitted = 0;
  for (let i = 0; i < admission.limits.maxStarts; i++) {
    const req = make();
    run(req, response(), () => admitted++);
    req.releaseAuditSlot();
    req.releaseAuditSlot();
  }
  const rate = response();
  run(make(), rate, () => assert.fail('rate limited request must not start'));
  assert.equal(rate.code, 429);
  assert.equal(rate.body.error, 'AUDIT_RATE_LIMIT');
  for (const req of [make('GET'), make('POST', '/api/audits/old'), make('POST', '/api/unrelated')]) {
    run(req, response(), () => admitted++);
    assert.equal(req.releaseAuditSlot, undefined);
  }
  assert.equal(admitted, admission.limits.maxStarts + 3);
  const fresh = make();
  admission.create()(fresh, response(), () => admitted++);
  fresh.releaseAuditSlot();
  assert.equal(admitted, admission.limits.maxStarts + 4);
});

test('start window expires without retaining per-request timestamps or URL history', t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const run = admission.create();
  const call = () => {
    const req = { method: 'POST', path: '/api/audits' };
    const res = { set(_name, value) { this.retry = value; return this; }, status(code) { this.code = code; return this; }, json() {} };
    let started = false;
    run(req, res, () => { started = true; });
    req.releaseAuditSlot?.();
    return { started, ...res };
  };
  for (let i = 0; i < admission.limits.maxStarts; i++) assert.equal(call().started, true);
  assert.equal(call().retry, '10');
  now += admission.limits.windowMs - 1;
  assert.equal(call().retry, '1');
  now += 1;
  assert.equal(call().started, true);
});

test('real entry enforces start admission and protects every Express audit URL variant before parsing', async t => {
  const server = await start(t);
  for (const path of ['/api/audits/', '/API/AUDITS', '/API/AUDITS/']) {
    const refused = await fetch(server.origin + path, { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(refused.status, 403);
    const malformed = await fetch(server.origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"url":"PRIVATE_MARKER' });
    assert.equal(malformed.status, 400);
    assert.ok(!(await malformed.text()).includes('PRIVATE_MARKER'));
  }
  for (let i = 0; i < admission.limits.maxStarts; i++) {
    const response = await fetch(server.origin + '/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"url":"http://10.0.0.1/"}' });
    assert.equal(response.status, 400);
    await response.text();
  }
  const limited = await post(server.origin);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  assert.equal((await limited.json()).error, 'AUDIT_RATE_LIMIT');
  assert.ok(!JSON.stringify(server.logs()).includes('PRIVATE_MARKER'));
  assert.equal(server.logs().stderr, '');
});
