const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns/promises');
const { getEventListeners } = require('node:events');
const zlib = require('node:zlib');
const path = require('node:path');
const os = require('node:os');
const provider = require('../app/data/pagespeed.data');
const service = require('../app/service/pagespeed.service');
const audit = require('../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, good } = require('./helpers/frontend');
const { base, lhr, jsonResponse, key } = require('./helpers/pagespeed');

test('missing backend key makes no provider/DNS request and cannot be overridden by client key/endpoint', async (t) => {
  key(t, '');
  const transport = stubTransport(t);
  const result = await service.run(base, { key: 'CLIENT_KEY', endpoint: 'http://127.0.0.1/' });
  assert.equal(result.reason, 'not-configured');
  assert.deepEqual(result.categories, []);
  assert.equal(transport.calls.length, 0);
  assert.equal(transport.resolvers.length, 0);
});

test('provider uses fixed HTTPS endpoint, four explicit categories, backend key, public DNS pinning and no browser auth/cookies', async (t) => {
  key(t);
  const transport = stubTransport(t, [jsonResponse()]);
  const result = await service.run(base + '#fragment');
  assert.equal(result.status, 'completed');
  const call = transport.calls[0];
  const endpoint = new URL(call.url);
  assert.equal(endpoint.origin, 'https://www.googleapis.com');
  assert.equal(endpoint.pathname, '/pagespeedonline/v5/runPagespeed');
  assert.deepEqual(endpoint.searchParams.getAll('category'), provider.categories);
  assert.equal(endpoint.searchParams.get('strategy'), 'mobile');
  assert.equal(endpoint.searchParams.get('url'), base);
  assert.equal(endpoint.searchParams.get('key'), 'SERVER_ONLY_TEST_KEY');
  assert.equal(call.options.agent, false);
  assert.equal(call.options.headers.Accept, 'application/json');
  assert.equal(call.options.headers.Authorization, undefined);
  assert.equal(call.options.headers.Cookie, undefined);
  assert.deepEqual(transport.resolvers, ['site.example', 'www.googleapis.com']);
  assert.equal(typeof call.options.lookup, 'function');
  assert.deepEqual(result.categories.map((entry) => entry.displayScore), [72, 91, 100, 0]);
  assert.equal(JSON.stringify(result).includes('SERVER_ONLY_TEST_KEY'), false);
});

test('invalid/private target and mixed-private provider DNS are refused before the provider socket', async (t) => {
  key(t);
  const transport = stubTransport(t);
  for (const value of ['http://127.0.0.1/', 'ftp://site.example/', 'https://user:pass@site.example/', 'https://site.example:8443/']) {
    const result = await service.run(value);
    assert.equal(result.status, 'not-checked');
  }
  t.mock.method(dns, 'lookup', async (host) => host === 'www.googleapis.com' ?
    [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]);
  assert.equal((await service.run(base)).reason, 'PRIVATE_TARGET');
  assert.equal(transport.calls.length, 0);
});

test('Google errors, quota/auth failures and API redirect produce honest empty scores without raw provider errors or secrets', async (t) => {
  key(t);
  const logs = t.mock.method(console, 'error', () => {});
  const cases = [[403, 'PAGESPEED_AUTH'], [401, 'PAGESPEED_AUTH'], [429, 'PAGESPEED_QUOTA'], [500, 'PAGESPEED_HTTP'], [302, 'PAGESPEED_REDIRECT']];
  const transport = stubTransport(t, cases.map(([status]) => ({ status, html: 'SECRET_ERROR_SERVER_ONLY_TEST_KEY',
    headers: { location: 'http://127.0.0.1/', 'content-type': 'text/html' } })));
  for (const [, reason] of cases) {
    const result = await service.run(base);
    assert.equal(result.reason, reason);
    assert.deepEqual(result.categories, []);
    assert.equal(JSON.stringify(result).includes('SECRET_ERROR'), false);
  }
  assert.equal(transport.calls.length, cases.length);
  assert.equal(logs.mock.calls.length, 0);
});

test('runtime errors, invalid JSON, absent LHR and wrong response URL never publish scores or raw runtime detail', async (t) => {
  key(t);
  stubTransport(t, [jsonResponse(lhr({ runtimeError: { code: 'FAILED', message: 'SERVER_ONLY_TEST_KEY' } })),
    { html: '{invalid', headers: { 'content-type': 'application/json' } },
    { html: '{}', headers: { 'content-type': 'application/json' } },
    jsonResponse(lhr({ requestedUrl: 'https://different.example/' })), jsonResponse(lhr({ lighthouseVersion: 'SERVER_ONLY_TEST_KEY' }))]);
  for (let i = 0; i < 5; ++i) {
    const result = await service.run(base);
    assert.equal(result.status, 'not-checked');
    assert.deepEqual(result.categories, []);
    assert.equal(JSON.stringify(result).includes('SERVER_ONLY_TEST_KEY'), false);
  }
});

test('null/missing/out-of-range/string scores stay unavailable while genuine zero and unchanged fractional scores remain valid', async (t) => {
  key(t);
  for (const score of [null, undefined, -1, 1.1, '0.99']) {
    const source = lhr();
    source.categories.performance.score = score;
    const transport = stubTransport(t, [jsonResponse(source)]);
    const result = await service.run(base);
    assert.equal(result.status, 'partial');
    assert.equal(result.categories[0].score, null);
    assert.equal(result.categories[0].displayScore, undefined);
    assert.equal(result.categories[3].displayScore, 0);
    assert.equal(transport.calls.length, 1);
    t.mock.restoreAll();
  }
});

test('provider MIME/charset, wire bytes, decompressed bytes and truncated bodies are bounded without leaking request URL/key', async (t) => {
  key(t);
  const cases = [
    { html: '{}', headers: { 'content-type': 'text/html' } },
    { html: '{}', headers: { 'content-type': 'application/json; charset=windows-1252' } },
    { headers: { 'content-type': 'application/json', 'content-length': String(provider.limits.maxBytes + 1) } },
    { chunks: [Buffer.alloc(provider.limits.maxBytes + 1)], headers: { 'content-type': 'application/json' } },
    { chunks: [zlib.gzipSync(Buffer.alloc(provider.limits.maxBytes + 1))], headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' } },
    { streamError: true, headers: { 'content-type': 'application/json' } }
  ];
  stubTransport(t, cases);
  for (let i = 0; i < cases.length; ++i) {
    const result = await service.run(base);
    assert.equal(result.status, 'not-checked');
    assert.deepEqual(result.categories, []);
    assert.equal(JSON.stringify(result).includes('www.googleapis.com'), false);
    assert.equal(JSON.stringify(result).includes('SERVER_ONLY_TEST_KEY'), false);
  }
});

test('deadline and cancellation destroy pending provider transport and remove listeners; cancellation is not a partial report', async (t) => {
  key(t);
  const transport = stubTransport(t, [{ neverRespond: true }, { neverRespond: true }]);
  assert.equal((await provider.run(base, { timeoutMs: 20 })).reason, 'PAGESPEED_TIMEOUT');
  assert.equal(transport.connections[0].destroyed, true);
  const controller = new AbortController();
  const pending = service.run(base, { signal: controller.signal });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, { code: 'CANCELLED' });
  assert.equal(transport.connections[1].destroyed, true);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('API opt-in uses only current provider facts, not SEO summary values, and fresh rounds do not reuse scores', async (t) => {
  key(t);
  const transport = stubTransport(t, [{ html: good }, { status: 404 }, jsonResponse(), { html: good }, { status: 404 }, { status: 429 }]);
  const first = (await audit.create({ url: base, pagespeed: true, key: 'CLIENT_KEY' })).data;
  const second = (await audit.create({ url: base, pagespeed: true })).data;
  assert.equal(first.lighthouse.status, 'completed');
  assert.ok(!first.notChecked.some((entry) => entry.id === 'lighthouse'));
  assert.deepEqual(second.lighthouse.categories, []);
  assert.equal(second.lighthouse.reason, 'PAGESPEED_QUOTA');
  assert.ok(second.notChecked.some((entry) => entry.id === 'lighthouse' && entry.reason === 'PAGESPEED_QUOTA'));
  assert.equal(first.lighthouse.categories[0].displayScore, 72);
  assert.equal(transport.calls.length, 6);
});

test('actual API/UI shows all four score circles, fresh failures clear them, mobile fits and F5 clears PageSpeed choice/results', async (t) => {
  key(t);
  stubTransport(t, [{ html: good }, { status: 404 }, jsonResponse(), { html: good }, { status: 404 }, { status: 429 }]);
  const { page, errors } = await frontend(t);
  assert.equal(await page.locator('#pagespeed-enabled').isChecked(), false);
  await page.locator('#pagespeed-enabled').check();
  await scan(page, base);
  await page.locator('[data-bs-target="#lighthouse-scores"]').click();
  const scores = page.locator('#lighthouse-categories');
  assert.equal(await scores.locator('[data-score-category]').count(), 4);
  assert.deepEqual(await scores.locator('[data-score-value]').allTextContents(), ['72', '91', '100', '0']);
  for (const [name, size] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(size);
    await scores.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const circle of await scores.locator('.ratio').all()) {
      const box = await circle.boundingBox();
      assert.ok(Math.abs(box.width - box.height) <= 1);
    }
    if (process.env.SEO_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-pagespeed-' + name + '.png') });
  }
  await scan(page, base);
  assert.equal(await scores.locator('[data-score-category]').count(), 0);
  assert.ok((await page.locator('#lighthouse-status').textContent()).includes('ขีดจำกัด'));
  await page.reload();
  assert.equal(await page.locator('#pagespeed-enabled').isChecked(), false);
  assert.equal(await scores.textContent(), '');
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.deepEqual(errors, []);
});

test('HTML-only audits do not request provider implicitly even when a backend key exists', async (t) => {
  key(t);
  const transport = stubTransport(t, [{ html: good }, { status: 404 }]);
  const result = (await audit.create({ url: base, pagespeed: 'true' })).data;
  assert.equal(result.lighthouse.reason, 'not-requested');
  assert.equal(transport.calls.length, 2);
});
