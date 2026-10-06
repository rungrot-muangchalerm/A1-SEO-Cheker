const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns/promises');
const { getEventListeners } = require('node:events');
const { setTimeout: wait } = require('node:timers/promises');
const { chromium } = require('playwright');
const website = require('../../app/data/website.data');
const audit = require('../../app/service/audit.service');
const renderer = require('../../app/service/render.service');
const { stubTransport } = require('./helpers/transport');
const { report } = require('./helpers/frontend');

const base = 'https://site.example/';
const markup = (scripts = '', extra = '') => '<title>Security fixture</title><meta name="description" content="Security">' +
  '<link rel="canonical" href="/"><body><h1>Fixture</h1>' + extra + scripts + '</body>';
const script = (value) => '<script>' + value + '</script>';
const scenario = (source, extra = []) => [{ html: source }, { status: 404 }, { status: 404 }, ...extra];
const execute = async (t, source, responses = []) => {
  const transport = stubTransport(t, scenario(source, responses));
  const result = await audit.create({ url: base, render: true });
  assert.equal(result.ok, true);
  return { rendered: result.data.pages[0].render, transport };
};

test('resource DNS rebinding/mixed public-private records is refused before an asset socket, even for the selected origin', async (t) => {
  const transport = stubTransport(t, scenario(markup('<script src="/rebind.js"></script>')));
  const lookup = dns.lookup;
  let resolutions = 0;
  t.mock.method(dns, 'lookup', async (...args) => {
    const publicRecords = await lookup(...args);
    return ++resolutions >= 4 ? [...publicRecords, { address: '127.0.0.1', family: 4 }] : publicRecords;
  });
  const result = (await audit.create({ url: base, render: true })).data.pages[0].render;
  assert.equal(result.status, 'partial');
  assert.ok(result.resources.records.some((entry) => entry.reason === 'PRIVATE_TARGET'));
  assert.equal(transport.calls.length, 3);
  assert.equal(result.after.title, 'Security fixture');
});

test('private/external URLs, credentials, ports, writes, navigation, subframes, websockets and workers cannot bypass the renderer transport gate', async (t) => {
  const code = 'for(const url of ["http://127.0.0.1/private","https://outside.example/","https://u:p@site.example/secret","https://site.example:444/private"]){fetch(url).catch(()=>{});}' +
    'fetch("/write",{method:"POST",body:"private"}).catch(()=>{});' +
    'new WebSocket("ws://127.0.0.1/private");' +
    'document.querySelector("h1").textContent=[typeof Worker,typeof SharedWorker,typeof RTCPeerConnection,typeof WebTransport].join(",");' +
    'navigator.serviceWorker.register("/worker.js").catch(()=>{});window.open("https://outside.example/popup");';
  const { rendered, transport } = await execute(t, markup(script(code), '<iframe src="/frame"></iframe>'));
  assert.equal(rendered.status, 'partial', JSON.stringify(rendered));
  assert.deepEqual(rendered.after.h1, ['undefined,undefined,undefined,undefined']);
  assert.equal(transport.calls.length, 3);
  const reasons = rendered.resources.records.map((entry) => entry.reason);
  for (const reason of ['OUTSIDE_SCOPE', 'PORT_NOT_ALLOWED', 'RENDER_METHOD_BLOCKED', 'RENDER_NAVIGATION_BLOCKED', 'WEBSOCKET_BLOCKED']) {
    assert.ok(reasons.includes(reason), JSON.stringify(reasons));
  }
  // Browser fetch rejects credential URLs before interception; the Node gate is checked separately.
  await assert.rejects(website.fetchRenderResource('https://u:p@site.example/secret'), { code: 'URL_CREDENTIALS' });
  assert.equal(transport.calls.length, 3);
});

test('redirect destinations are checked before DNS and robots disallow also applies to same-origin redirected assets', async (t) => {
  const outside = await execute(t, markup('<script src="/alias.js"></script>'), [{ status: 302, headers: { location: 'http://127.0.0.1/private' } }]);
  assert.equal(outside.transport.calls.length, 4);
  assert.ok(outside.rendered.resources.records.some((entry) => entry.status === 302));
  assert.ok(outside.rendered.resources.records.some((entry) => entry.reason === 'OUTSIDE_SCOPE'));
  t.mock.restoreAll();
  const transport = stubTransport(t, [{ html: markup('<script src="/alias.js"></script>') }, { status: 404 },
    { html: 'User-agent: SEOChecker\nDisallow: /blocked.js' }, { status: 302, headers: { location: '/blocked.js' } }]);
  const rendered = (await audit.create({ url: base, render: true })).data.pages[0].render;
  assert.equal(transport.calls.length, 4);
  assert.ok(rendered.resources.records.some((entry) => entry.reason === 'ROBOTS_BLOCKED'));
  assert.equal(transport.calls.some((entry) => entry.url.endsWith('/blocked.js')), false);
});

test('browser cookies, authorization, custom request headers and upstream Set-Cookie are not replayed or forwarded to Node requests', async (t) => {
  const source = markup(script('document.cookie="audit=private";fetch("/data",{headers:{Authorization:"Bearer PRIVATE", "X-Private":"PRIVATE"}}).then(()=>{});'));
  const { rendered, transport } = await execute(t, source, [{ html: '{}', headers: { 'content-type': 'application/json', 'set-cookie': 'upstream=secret; Path=/' } }]);
  assert.equal(rendered.status, 'completed', JSON.stringify(rendered));
  assert.equal(transport.calls.length, 4);
  const headers = transport.calls.at(-1).options.headers;
  assert.equal(headers.Cookie, undefined);
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers['X-Private'], undefined);
  assert.equal(transport.calls.at(-1).options.agent, false);
  assert.equal(typeof transport.calls.at(-1).options.lookup, 'function');
});

test('all resource hops are serial and paced at socket creation; redirects cannot exceed their hop limit', async (t) => {
  const starts = [];
  const { transport } = await execute(t, markup('<script src="/loop.js"></script>'),
    Array.from({ length: 8 }, () => ({ status: 302, headers: { location: '/loop.js' } })));
  assert.equal(transport.calls.length, 3 + renderer.limits.maxRedirects + 1);
  t.mock.restoreAll();
  const source = markup(script('fetch("/a");fetch("/b");fetch("/c");'));
  const timed = stubTransport(t, scenario(source, Array.from({ length: 3 }, () => ({ html: '{}', headers: { 'content-type': 'application/json' } }))));
  const request = require('node:https').request;
  let active = 0;
  let peak = 0;
  t.mock.method(require('node:https'), 'request', (...args) => {
    const [url, options, callback] = args;
    if (timed.calls.length >= 2) starts.push(Date.now());
    ++active;
    peak = Math.max(peak, active);
    return request(url, options, (response) => { response.once('close', () => --active); callback(response); });
  });
  const rendered = (await audit.create({ url: base, render: true })).data.pages[0].render;
  assert.equal(rendered.status, 'completed');
  assert.equal(peak, 1);
  assert.equal(active, 0);
  assert.equal(starts.length, 4);
  for (let index = 1; index < starts.length; ++index) assert.ok(starts[index] - starts[index - 1] >= renderer.limits.minIntervalMs - 15);
});

test('failed oversized assets consume reserved byte budget; later resources stop without fetching or saving their bodies', async (t) => {
  const tags = Array.from({ length: 10 }, (_, index) => '<script src="/large-' + index + '.js"></script>').join('');
  const { rendered, transport } = await execute(t, markup(tags), Array.from({ length: 10 }, () => ({
    html: 'BODY_MUST_NOT_BE_RETAINED', headers: { 'content-type': 'text/javascript', 'content-length': String(renderer.limits.maxResourceBytes + 1) }
  })));
  assert.equal(rendered.status, 'partial');
  assert.equal(transport.calls.length, 3 + renderer.limits.maxTotalBytes / renderer.limits.maxResourceBytes);
  assert.equal(rendered.stats.budgetBytes, renderer.limits.maxTotalBytes);
  assert.equal(rendered.stats.bytes, 0);
  assert.ok(rendered.resources.records.some((entry) => entry.reason === 'RESPONSE_TOO_LARGE'));
  assert.ok(rendered.resources.records.some((entry) => entry.reason === 'RENDER_BYTE_LIMIT'));
  assert.equal(JSON.stringify(rendered).includes('BODY_MUST_NOT_BE_RETAINED'), false);
});

test('native and intercepted request caps stop excessive script fetch queues; API input cannot raise resource limits', async (t) => {
  const source = markup(script('for(let index=0;index<35;index++){fetch("/item-"+index).catch(()=>{});}'));
  const transport = stubTransport(t, scenario(source, Array.from({ length: 35 }, () => ({ html: '{}', headers: { 'content-type': 'application/json' } }))));
  const rendered = (await audit.create({ url: base, render: true, maxRequests: 999, maxBytes: 999999999 })).data.pages[0].render;
  assert.equal(rendered.stats.requests, renderer.limits.maxRequests);
  assert.equal(transport.calls.length, renderer.limits.maxRequests + 2);
  assert.ok(rendered.resources.records.some((entry) => entry.reason === 'RENDER_REQUEST_LIMIT'));
  t.mock.restoreAll();
  const storm = await execute(t, markup(script('for(let index=0;index<150;index++){fetch("/storm-"+index).catch(()=>{});}')));
  assert.equal(storm.rendered.status, 'not-checked');
  assert.equal(storm.rendered.reason, 'RENDER_REQUEST_LIMIT');
  assert.ok(storm.transport.calls.length <= renderer.limits.maxRequests + 2);
  assert.ok(storm.rendered.resources.records.length <= renderer.limits.maxRecords);
});

test('DOM element/byte limits and CSP-blocked execution disclose unavailable or incomplete rendering instead of trusting a shortened DOM', async (t) => {
  for (const [code, reason] of [
    ['document.body.innerHTML="<p>x</p>".repeat(' + (renderer.limits.maxElements + 1) + ');', 'RENDER_ELEMENT_LIMIT'],
    ['document.body.textContent="x".repeat(' + (renderer.limits.maxDomBytes + 1) + ');', 'RENDER_DOM_LIMIT']
  ]) {
    const { rendered } = await execute(t, markup(script(code)));
    assert.equal(rendered.reason, reason);
    assert.equal(rendered.after, undefined);
    t.mock.restoreAll();
  }
  stubTransport(t, [{ html: markup(script('document.title="Must not execute";')), headers: { 'content-security-policy': "script-src 'none'" } },
    { status: 404 }, { status: 404 }]);
  const rendered = (await audit.create({ url: base, render: true })).data.pages[0].render;
  assert.equal(rendered.after.title, 'Security fixture');
  assert.equal(rendered.status, 'partial');
  assert.ok(rendered.resources.consoleErrors > 0);
  assert.equal(rendered.after.html.includes('Must not execute'), true);
});

test('a real CPU-bound infinite script is stopped by the round deadline and the browser is closed without a fake snapshot', async (t) => {
  const launch = chromium.launch.bind(chromium);
  let browser;
  t.mock.method(chromium, 'launch', async (options) => { browser = await launch(options); return browser; });
  const started = Date.now();
  const { rendered } = await execute(t, markup(script('while(true){}')));
  assert.equal(rendered.reason, 'RENDER_TIMEOUT');
  assert.equal(rendered.after, undefined);
  assert.equal(browser.isConnected(), false);
  assert.ok(Date.now() - started >= renderer.limits.timeoutMs - 1000);
  assert.ok(Date.now() - started < renderer.limits.timeoutMs + 8000);
});

test('cancelling before launch opens no socket; cancelling a pending asset closes its socket/browser and removes external abort listeners', async (t) => {
  const stopped = new AbortController();
  stopped.abort();
  const untouched = stubTransport(t);
  const page = report(base, markup(script('document.title="Should not run";'))).pages[0];
  await assert.rejects(renderer.run([page], { signal: stopped.signal }), { code: 'CANCELLED' });
  assert.equal(untouched.calls.length, 0);
  t.mock.restoreAll();
  const transport = stubTransport(t, scenario(markup('<script src="/slow.js"></script>'), [{ neverRespond: true }]));
  const launch = chromium.launch.bind(chromium);
  let browser;
  const controller = new AbortController();
  let lateProtocolCommands = 0, simultaneousContextCloses = 0;
  t.mock.method(chromium, 'launch', async (options) => {
    browser = await launch(options);
    const newContext = browser.newContext.bind(browser);
    t.mock.method(browser, 'newContext', async options => {
      const context = await newContext(options);
      const close = context.close.bind(context);
      t.mock.method(context, 'close', (...args) => {
        if (controller.signal.aborted) simultaneousContextCloses++;
        return close(...args);
      });
      const newSession = context.newCDPSession.bind(context);
      t.mock.method(context, 'newCDPSession', async page => {
        const session = await newSession(page);
        const send = session.send.bind(session);
        t.mock.method(session, 'send', (method, params) => {
          if (controller.signal.aborted && ['Fetch.failRequest', 'Fetch.fulfillRequest'].includes(method)) lateProtocolCommands++;
          return send(method, params);
        });
        return session;
      });
      return context;
    });
    return browser;
  });
  t.after(() => controller.abort());
  const operation = audit.create({ url: base, render: true }, { signal: controller.signal });
  const deadline = Date.now() + 10000;
  while (transport.calls.length < 4 && Date.now() < deadline) await wait(20);
  assert.equal(transport.calls.length, 4);
  controller.abort();
  assert.deepEqual(await operation, { ok: false, code: 'CANCELLED' });
  assert.equal(transport.connections.at(-1).destroyed, true);
  assert.equal(browser.isConnected(), false);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(lateProtocolCommands, 0);
  assert.equal(simultaneousContextCloses, 0);
});

test('render resources preserve actual raw bounded bytes/MIME, decompression limits and a redirect hop without forwarding browser headers', async (t) => {
  const bytes = Buffer.from([0x63, 0x61, 0x66, 0xe9]);
  const transport = stubTransport(t, [{ chunks: [bytes], headers: { 'content-type': 'text/javascript; charset=iso-8859-1' } },
    { status: 301, headers: { location: '/actual.js' } }]);
  const result = await website.fetchRenderResource(base + 'script.js');
  assert.deepEqual(result.body, bytes);
  assert.equal(result.bytes, bytes.length);
  const redirect = await website.fetchRenderResource(base + 'alias.js');
  assert.equal(redirect.status, 301);
  assert.equal(redirect.redirect, '/actual.js');
  assert.equal(redirect.body.length, 0);
  assert.equal(transport.calls.length, 2);
});
