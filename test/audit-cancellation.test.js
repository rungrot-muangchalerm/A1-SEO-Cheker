const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, getEventListeners } = require('node:events');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns/promises');
const express = require('express');
const website = require('../app/data/website.data');
const auditController = require('../app/controller/audit.controller');
const { stubTransport } = require('./helpers/transport');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('already cancelled work opens no DNS request or socket', async (t) => {
  const transport = stubTransport(t);
  const controller = new AbortController();
  controller.abort(new Error('Private user context'));
  await assert.rejects(website.fetchPage('https://cancel.example/', { signal: controller.signal }), { code: 'CANCELLED' });
  assert.equal(transport.calls.length, 0);
  assert.equal(transport.resolvers.length, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('DNS completion after cancellation cannot start a request', async (t) => {
  const transport = stubTransport(t);
  const lookup = deferred();
  t.mock.method(dns, 'lookup', () => lookup.promise);
  const controller = new AbortController();
  const operation = website.fetchPage('https://dns-cancel.example/', { signal: controller.signal });
  controller.abort();
  await assert.rejects(operation, { code: 'CANCELLED' });
  lookup.resolve([{ address: '8.8.8.8', family: 4 }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(transport.calls.length, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('cancelling during a real TCP body closes the upstream connection', async (t) => {
  const started = deferred();
  const closed = deferred();
  const bodyStarted = deferred();
  let interval;
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write('<html>');
    interval = setInterval(() => res.write('still streaming'), 20);
    res.once('close', () => { clearInterval(interval); closed.resolve(); });
    started.resolve();
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => upstream.once('listening', resolve));
  t.after(() => {
    clearInterval(interval);
    upstream.closeAllConnections();
    return new Promise((resolve) => upstream.close(resolve));
  });
  t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  // Route only the test transport to its TCP fixture; production URL validation remains enabled.
  t.mock.method(https, 'request', (url, options, callback) => http.request(
    'http://127.0.0.1:' + upstream.address().port, { ...options, lookup: undefined }, (response) => {
      callback(response);
      response.once('data', () => bodyStarted.resolve());
    }
  ));
  const controller = new AbortController();
  const operation = website.fetchPage('https://tcp-fixture.example/', { signal: controller.signal });
  await started.promise;
  await bodyStarted.promise;
  controller.abort();
  await assert.rejects(operation, { code: 'CANCELLED' });
  await closed.promise;
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('HTTP client disconnect aborts its audit without sending a later report', async (t) => {
  const started = deferred();
  const cancelled = deferred();
  let signal;
  t.mock.method(website, 'fetchPage', (url, options) => new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => {
      cancelled.resolve();
      reject(new website.WebsiteError('CANCELLED'));
    }, { once: true });
    started.resolve();
  }));
  const app = express();
  app.use(express.json());
  app.use(require('../app/routes/router'));
  app.use(require('../app/middleware/audit.middleware').error);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  let responses = 0;
  const client = http.request('http://127.0.0.1:' + server.address().port + '/api/audits', {
    method: 'POST', agent: false, headers: { 'Content-Type': 'application/json' }
  }, () => { responses += 1; });
  client.on('error', () => {});
  client.end('{"url":"https://public.example/"}');
  await started.promise;
  client.destroy();
  await cancelled.promise;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(signal.aborted, true);
  assert.equal(responses, 0);
  assert.equal(getEventListeners(signal, 'abort').length, 0);
});

test('normal completion removes the response close listener', async (t) => {
  t.mock.method(website, 'fetchPage', async () => ({
    requestedUrl: 'https://public.example/', finalUrl: 'https://public.example/', status: 200,
    html: '<title>Normal</title>', headers: {}, bytes: 21, redirects: []
  }));
  const response = new EventEmitter();
  response.set = () => response;
  response.status = () => response;
  response.json = () => { response.writableEnded = true; return response; };
  await auditController.create({ body: { url: 'https://public.example/' } }, response);
  assert.equal(response.writableEnded, true);
  assert.equal(response.listenerCount('close'), 0);
});
