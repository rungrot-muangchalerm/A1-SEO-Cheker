const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { EventEmitter, getEventListeners } = require('node:events');
const audit = require('../../app/service/audit.service');
const controller = require('../../app/controller/audit.controller');
const { stubTransport } = require('./helpers/transport');

const progress = { phase: 'crawling', origin: 'https://site.example', discovered: 2, fetched: 1, analyzed: 1, skipped: 0, skippedEntries: [] };
async function api(t) {
  const app = express();
  app.use(express.json());
  app.use(require('../../app/routes/router'));
  app.use(require('../../app/middleware/audit.middleware').error);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  return 'http://127.0.0.1:' + server.address().port;
}
const request = (origin, body) => fetch(origin + '/api/audits', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify(body) });

test('one POST connection streams real counts before completion and finishes with one report, not a saved job', async (t) => {
  stubTransport(t, [{ status: 404 }, { html: '<title>Root</title><a href="/child">Child</a><a href="/pdf">PDF</a>' },
    { status: 404 }, { html: '<title>Child</title>' }, { html: 'PDF', headers: { 'content-type': 'application/pdf' } }]);
  const origin = await api(t);
  const response = await request(origin, { url: 'https://site.example/', crawl: true });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  assert.match(response.headers.get('content-type'), /^application\/x-ndjson/);
  const reader = response.body.getReader();
  const first = await reader.read();
  const initial = JSON.parse(new TextDecoder().decode(first.value).trim().split('\n')[0]);
  assert.equal(initial.type, 'progress');
  assert.equal(initial.data.fetched, 1);
  assert.equal(initial.data.analyzed, 1);
  let body = new TextDecoder().decode(first.value);
  for (;;) { const chunk = await reader.read(); if (chunk.done) break; body += new TextDecoder().decode(chunk.value); }
  reader.releaseLock();
  const frames = body.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(frames.filter((entry) => entry.type === 'report').length, 1);
  assert.equal(frames.at(-1).type, 'report');
  const report = frames.at(-1).data;
  const last = frames.at(-2).data;
  assert.equal(last.discovered, report.coverage.discovered);
  assert.equal(last.fetched, report.coverage.fetched);
  assert.equal(last.skipped, report.coverage.skipped.length);
  assert.equal(last.skippedEntries[0].reason, 'UNSUPPORTED_TYPE');
  assert.equal(report.auditId, undefined);
  assert.equal((await fetch(origin + '/api/audits/history')).status, 404);
});

test('pre-stream errors keep their HTTP status; failures after headers use an error frame without a report', async (t) => {
  const origin = await api(t);
  const invalid = await request(origin, {});
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).status, 'failed');
  t.mock.method(audit, 'create', async (_body, options) => {
    await options.onProgress(progress);
    return { ok: false, code: 'INTERNAL_ERROR' };
  });
  const response = await request(origin, { url: 'https://site.example/', crawl: true });
  const frames = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(frames.map((entry) => entry.type), ['progress', 'error']);
  assert.equal(frames.at(-1).data.status, 'failed');
  assert.equal(frames.at(-1).data.pages, undefined);
});

test('stream backpressure waits for drain and disconnect removes listeners and cancels work', async (t) => {
  let signal;
  t.mock.method(audit, 'create', async (_body, options) => {
    signal = options.signal;
    await options.onProgress(progress);
    assert.fail('Disconnected backpressure must not continue work');
  });
  const response = new EventEmitter();
  response.set = () => response;
  response.status = () => response;
  response.flushHeaders = () => { response.headersSent = true; };
  response.write = () => false;
  const operation = controller.create({ headers: { accept: 'application/x-ndjson' }, accepts: () => true, body: {} }, response);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(response.listenerCount('drain'), 1);
  assert.equal(signal.aborted, false);
  response.destroyed = true;
  response.emit('close');
  await operation;
  assert.equal(signal.aborted, true);
  assert.equal(response.listenerCount('close'), 0);
  assert.equal(response.listenerCount('drain'), 0);
  assert.equal(getEventListeners(signal, 'abort').length, 0);
});
