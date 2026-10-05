const test = require('node:test');
const assert = require('node:assert/strict');
const { getEventListeners } = require('node:events');
const dns = require('node:dns/promises');
const audit = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');

async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Fixture request must start');
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('cancel before starting and while resolving DNS cannot start any socket or leave a signal listener', async (t) => {
  const transport = stubTransport(t);
  const cancelled = new AbortController();
  cancelled.abort();
  const result = await audit.create({ url: 'https://site.example/', crawl: true }, { signal: cancelled.signal });
  assert.equal(result.code, 'CANCELLED');
  assert.equal(transport.calls.length, 0);
  let started = false;
  let release;
  t.mock.method(dns, 'lookup', () => { started = true; return new Promise((resolve) => { release = resolve; }); });
  const controller = new AbortController();
  const operation = audit.create({ url: 'https://site.example/', crawl: true }, { signal: controller.signal });
  await until(() => started);
  controller.abort();
  assert.equal((await operation).code, 'CANCELLED');
  release([{ address: '93.184.216.34', family: 4 }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(transport.calls.length, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('cancel during robots, pacing, sitemap and child fetch stops work without returning a partial report', async (t) => {
  const scenarios = [
    { responses: [{ neverRespond: true }], count: 1 },
    { responses: [{ status: 404 }], count: 1 },
    { responses: [{ status: 404 }, { html: '<title>Root</title><a href="/child">Child</a>' }, { neverRespond: true }], count: 3 },
    { responses: [{ status: 404 }, { html: '<title>Root</title><a href="/child">Child</a>' }, { status: 404 }, { neverRespond: true }], count: 4 }
  ];
  for (const scenario of scenarios) {
    t.mock.restoreAll();
    const transport = stubTransport(t, scenario.responses);
    const controller = new AbortController();
    const operation = audit.create({ url: 'https://site.example/', crawl: true }, { signal: controller.signal });
    await until(() => transport.calls.length === scenario.count);
    controller.abort();
    const result = await operation;
    assert.deepEqual(result, { ok: false, code: 'CANCELLED' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(transport.calls.length, scenario.count);
    if (scenario.responses.at(-1).neverRespond) assert.equal(transport.connections.at(-1).destroyed, true);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  }
});
