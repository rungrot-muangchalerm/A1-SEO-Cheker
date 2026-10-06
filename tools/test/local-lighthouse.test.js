const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const dns = require('node:dns/promises');
const path = require('node:path');
const os = require('node:os');
const { getEventListeners } = require('node:events');
const { setTimeout: wait } = require('node:timers/promises');
const puppeteer = require('puppeteer-core').default;
const ExcelJS = require('exceljs');
const website = require('../../app/data/website.data');
const lighthouse = require('../../app/service/lighthouse.service');
const result = require('../../app/service/lighthouse-result.service');
const { start, document: markup } = require('./helpers/development-site');
const { frontend, scan } = require('./helpers/frontend');
const { lhr } = require('./helpers/lighthouse');

async function download(page, selector) {
  const event = page.waitForEvent('download');
  await page.locator(selector).click();
  const stream = await (await event).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('local result normalization preserves actual zero/null scores, engine and mode without inventing indexing observations', () => {
  const url = 'http://localhost:5173/';
  const options = { ...website.auditOptions(url), provider: 'lighthouse-local', strategy: 'mobile' };
  const source = lhr({ requestedUrl: url, finalUrl: url, categories: { performance: { score: 0 }, seo: { score: null } } });
  const report = result.format({ status: 'received', data: { lighthouseResult: source } }, url, options);
  assert.equal(report.provider, 'lighthouse-local');
  assert.equal(report.status, 'partial');
  assert.equal(report.categories[0].score, 0);
  assert.equal(report.categories[0].displayScore, 0);
  assert.equal(report.categories[3].score, null);
  assert.equal(report.engine.version, source.lighthouseVersion);
  assert.equal(report.mode.formFactor, 'mobile');
  const runtime = result.format({ status: 'received', data: { lighthouseResult: { ...source, runtimeError: { message: 'PRIVATE_MARKER' } } } }, url, options);
  assert.equal(runtime.reason, 'LIGHTHOUSE_RUNTIME');
  assert.deepEqual(runtime.categories, []);
  assert.ok(!JSON.stringify(runtime).includes('PRIVATE_MARKER'));
  const wrong = result.format({ status: 'received', data: { lighthouseResult: { ...source, finalUrl: 'http://localhost:4000/' } } }, url, options);
  assert.equal(wrong.reason, 'LIGHTHOUSE_INVALID_RESPONSE');
});

test('real local mobile Lighthouse computes all four categories without a key, external API requests, stored reports or exposed browser credentials', { timeout: 150000 }, async t => {
  const site = await start(t);
  let remoteRequests = 0;
  t.mock.method(https, 'request', () => { ++remoteRequests; throw new Error('Unexpected external request'); });
  const report = await lighthouse.run(site.origin + '/', { ...website.auditOptions(site.origin + '/'), strategy: 'mobile' });
  assert.equal(report.status, 'completed', report.reason);
  assert.equal(report.provider, 'lighthouse-local');
  assert.equal(report.engine.version, '13.5.0');
  assert.equal(report.mode.formFactor, 'mobile');
  assert.equal(report.mode.throttlingMethod, 'simulate');
  assert.equal(report.categories.length, 4);
  assert.equal(report.agentic.status, 'completed');
  assert.equal(report.agentic.audits.length, 7);
  assert.equal(report.agentic.notChecked, 0);
  assert.deepEqual(report.agentic.engineFraction, { passed: report.agentic.passed, total: report.agentic.total });
  for (const category of report.categories) {
    assert.equal(category.status, 'completed');
    assert.ok(Number.isFinite(category.score) && category.score >= 0 && category.score <= 1);
    assert.equal(category.displayScore, Math.round(category.score * 100));
  }
  assert.equal(remoteRequests, 0);
  assert.ok(site.requests.some(request => request.path === '/style.css'));
  assert.ok(site.requests.some(request => request.path === '/pixel.png'));
  assert.ok(site.requests.some(request => request.path === '/llms.txt'));
  assert.ok(site.requests.some(request => request.path === '/.well-known/ai-catalog.json'));
  assert.ok(site.requests.every(request => request.method === 'GET' && !request.headers.cookie && !request.headers.authorization));
  assert.ok(report.network.bytes > 0 && report.network.bytes <= lighthouse.limits.maxTotalBytes);
  assert.ok(!report.network.records.some(entry => entry.reason));
});

test('actual browser/API localhost desktop workflow shows real Lighthouse scores, exports JSON/XLSX and F5 restores the local default with no history', { timeout: 150000 }, async t => {
  const site = await start(t);
  const audit = require('../../app/service/audit.service');
  const create = audit.create;
  let report;
  t.mock.method(audit, 'create', async (body, options) => {
    const outcome = await create(body, options);
    report = outcome.data;
    return outcome;
  });
  const { page, errors } = await frontend(t);
  page.setDefaultTimeout(120000);
  await page.reload();
  await page.waitForFunction(() => window.bootstrap && document.querySelector('header svg'));
  assert.equal(await page.locator('#lighthouse-enabled').isChecked(), true);
  assert.equal(await page.locator('#pagespeed-enabled').count(), 0);
  await page.locator('label[for="strategy-desktop"]').click();
  await page.locator('#crawl-pages').check();
  const event = page.waitForResponse(response => response.url().endsWith('/api/audits'));
  await scan(page, site.origin + '/', { lighthouse: true });
  assert.ok((await event).headers()['content-type'].startsWith('application/x-ndjson'));
  assert.ok(report);
  assert.equal(report.scope.environment, 'local-development');
  assert.equal(report.lighthouse.status, 'completed', report.lighthouse.reason);
  assert.equal(report.lighthouse.provider, 'lighthouse-local');
  assert.equal(report.lighthouse.mode.formFactor, 'desktop');
  assert.equal(report.pages.length, 4);
  assert.ok((await page.locator('#lighthouse-status').textContent()).startsWith('Lighthouse'));
  for (const category of report.lighthouse.categories) {
    assert.equal(await page.locator('[data-score-category="' + category.id + '"] [data-score-value]').textContent(), String(category.displayScore));
  }
  const json = JSON.parse((await download(page, '#export-json-button')).toString('utf8'));
  assert.equal(json.lighthouse.provider, 'lighthouse-local');
  assert.deepEqual(json.lighthouse.categories, report.lighthouse.categories);
  assert.deepEqual(json.lighthouse.agentic, report.lighthouse.agentic);
  assert.ok((await page.locator('#agentic-status').textContent()).includes(report.lighthouse.agentic.passed + '/' + report.lighthouse.agentic.total));
  assert.equal(await page.locator('[data-agentic-audit]').count(), report.lighthouse.agentic.audits.length);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await download(page, '#export-xlsx-button'));
  assert.equal(workbook.getWorksheet('Pages').rowCount, 5);
  for (const [index, category] of json.lighthouse.categories.entries()) {
    assert.equal(workbook.getWorksheet('Scores').getCell('C' + (index + 2)).value, category.score);
    assert.equal(workbook.getWorksheet('Scores').getCell('G' + (index + 2)).value, 'lighthouse-local');
  }
  for (const [index, audit] of json.lighthouse.agentic.audits.entries()) {
    const row = index + 2;
    assert.equal(workbook.getWorksheet('Agentic').getCell('A' + row).value, audit.id);
    assert.equal(workbook.getWorksheet('Agentic').getCell('C' + row).value, audit.status);
    assert.deepEqual(JSON.parse(workbook.getWorksheet('Agentic').getCell('H' + row).value), audit.evidence);
    assert.equal(workbook.getWorksheet('Agentic').getCell('L' + row).value, report.lighthouse.engine.version);
  }
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 320) await page.locator('[data-bs-target="#lighthouse-scores"]').click();
    await page.waitForFunction(() => document.getElementById('lighthouse-scores').classList.contains('show'));
    await page.locator('[data-agentic-audit="llms-txt"]').evaluate(element => { element.open = true; });
    await page.locator('[data-agentic-audit="ard-schema"]').evaluate(element => { element.open = true; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SEO_SCREENSHOTS === 'true') {
      await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-local-lighthouse-' + width + '.png'), fullPage: true });
    }
  }
  await page.reload();
  await page.waitForFunction(() => window.bootstrap && document.querySelector('header svg'));
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.equal(await page.locator('#report').isVisible(), false);
  assert.equal(await page.locator('[data-agentic-audit]').count(), 0);
  assert.equal(await page.locator('#lighthouse-enabled').isChecked(), true);
  assert.equal(await page.locator('#pagespeed-enabled').count(), 0);
  assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
  assert.deepEqual(errors, []);
});

test('native Agentic identifies an unnamed button with real node evidence, then passes after fixing HTML; absent optional catalog is N/A', { timeout: 150000 }, async t => {
  const site = await start(t, { routes: {
    '/llms.txt': (_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('# Local fixture\n\nA controlled local website for actual agentic audits.\n\n- [Home](/)\n'); },
    '/.well-known/ai-catalog.json': (_req, res) => { res.writeHead(404); res.end(); }
  } });
  const root = body => site.routes.set('/', (_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(markup('Agentic fixture', body)); });
  root('<button id="empty"></button>');
  const options = { ...website.auditOptions(site.origin + '/'), strategy: 'desktop' };
  const bad = await lighthouse.run(site.origin + '/', options);
  assert.equal(bad.status, 'completed', JSON.stringify(bad.network?.records));
  const tree = bad.agentic.audits.find(audit => audit.id === 'agent-accessibility-tree');
  assert.equal(tree.status, 'fail');
  assert.ok(tree.evidence.some(entry => entry.selector.includes('#empty') && entry.snippet.includes('<button')), JSON.stringify(tree.evidence));
  assert.equal(bad.agentic.audits.find(audit => audit.id === 'llms-txt').status, 'pass');
  assert.equal(bad.agentic.audits.find(audit => audit.id === 'ard-schema').status, 'not-applicable');
  assert.equal(bad.agentic.failed, 1);
  root('<button id="empty" aria-label="Continue">Continue</button>');
  const fixed = await lighthouse.run(site.origin + '/', options);
  assert.equal(fixed.agentic.audits.find(audit => audit.id === 'agent-accessibility-tree').status, 'pass');
  assert.equal(fixed.agentic.failed, 0);
  assert.equal(fixed.agentic.passed, fixed.agentic.total);
  assert.equal(fixed.agentic.total, 3);
});

test('Agentic auxiliary fetches respect robots, local-port and byte limits without converting refusals into failed checks', { timeout: 150000 }, async t => {
  const other = await start(t);
  const site = await start(t, { routes: {
    '/robots.txt': (_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('User-agent: *\nDisallow: /llms.txt\n'); }
  } });
  site.routes.set('/', (_req, res) => { res.writeHead(200, { 'content-type': 'text/html', link: '<' + other.origin + '/secret>; rel="ai-catalog"' }); res.end(markup('Agentic protected fixture', '<p>Visible page.</p>')); });
  const report = await lighthouse.run(site.origin + '/', website.auditOptions(site.origin + '/'));
  assert.equal(report.status, 'partial');
  assert.equal(report.agentic.status, 'partial');
  assert.equal(report.agentic.notChecked, 2);
  assert.equal(report.agentic.failed, 0);
  assert.equal(report.agentic.audits.find(audit => audit.id === 'llms-txt').reason, 'ROBOTS_BLOCKED');
  assert.equal(report.agentic.audits.find(audit => audit.id === 'ard-schema').reason, 'PORT_NOT_ALLOWED');
  assert.equal(other.requests.length, 0);
  assert.ok(!site.requests.some(request => request.path === '/llms.txt'));
  assert.ok(report.network.budgetBytes <= lighthouse.limits.maxTotalBytes);
  assert.ok(site.requests.every(request => request.method === 'GET' && !request.headers.cookie && !request.headers.authorization));
});

test('cancelling an active Agentic file read closes its actual socket and Lighthouse browser before completion', { timeout: 120000 }, async t => {
  let disconnected = false;
  const site = await start(t, { routes: {
    '/llms.txt': (_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.write('# Slow fixture\n'); res.on('close', () => { disconnected = true; }); }
  } });
  const controller = new AbortController();
  const launch = puppeteer.launch.bind(puppeteer);
  let browser;
  t.mock.method(puppeteer, 'launch', async options => { browser = await launch(options); return browser; });
  const pending = lighthouse.run(site.origin + '/', { ...website.auditOptions(site.origin + '/'), signal: controller.signal });
  const rejection = assert.rejects(pending, { code: 'CANCELLED' });
  const deadline = Date.now() + 60000;
  while (!site.requests.some(request => request.path === '/llms.txt') && Date.now() < deadline) await wait(50);
  assert.ok(site.requests.some(request => request.path === '/llms.txt'));
  controller.abort();
  await rejection;
  assert.equal(disconnected, true);
  assert.equal(browser.connected, false);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('invalid strategy, private targets, browser launch failures and pre-cancelled runs publish no fabricated scores or raw error', async t => {
  const site = await start(t);
  let launches = 0;
  t.mock.method(puppeteer, 'launch', async () => { ++launches; throw new Error('PRIVATE_MARKER'); });
  const options = website.auditOptions(site.origin + '/');
  assert.equal((await lighthouse.run(site.origin + '/', { ...options, strategy: 'tablet' })).reason, 'LIGHTHOUSE_INVALID_STRATEGY');
  assert.equal((await lighthouse.run('http://192.168.1.1/')).reason, 'PRIVATE_TARGET');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(lighthouse.run(site.origin + '/', { ...options, signal: controller.signal }), { code: 'CANCELLED' });
  assert.equal(launches, 0);
  const failed = await lighthouse.run(site.origin + '/', options);
  assert.equal(failed.reason, 'BROWSER_UNAVAILABLE');
  assert.deepEqual(failed.categories, []);
  assert.ok(!JSON.stringify(failed).includes('PRIVATE_MARKER'));
  assert.equal(launches, 1);
});

test('cancelling live local Lighthouse aborts its pending socket and closes its browser before releasing the round', { timeout: 120000 }, async t => {
  const controller = new AbortController();
  let disconnected = false;
  const site = await start(t, { scripts: '<script>fetch("/slow").catch(()=>{});</script>', routes: {
    '/slow': (_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); res.on('close', () => { disconnected = true; }); }
  } });
  const launch = puppeteer.launch.bind(puppeteer);
  let browser;
  t.mock.method(puppeteer, 'launch', async options => { browser = await launch(options); return browser; });
  const operation = lighthouse.run(site.origin + '/', { ...website.auditOptions(site.origin + '/'), signal: controller.signal });
  const rejected = assert.rejects(operation, { code: 'CANCELLED' });
  const deadline = Date.now() + 60000;
  while (!site.requests.some(request => request.path === '/slow') && Date.now() < deadline) await wait(50);
  assert.ok(site.requests.some(request => request.path === '/slow'));
  controller.abort();
  await rejected;
  assert.equal(disconnected, true);
  assert.equal(browser.connected, false);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('native Lighthouse blocks writes, other local ports, private DNS, subframes and denied robots while keeping real partial scores', { timeout: 150000 }, async t => {
  const other = await start(t);
  const site = await start(t, { scripts: '<script>' +
    'fetch("/write",{method:"POST",body:"PRIVATE_WRITE"}).catch(()=>{});' +
    'fetch("/after-cookie",{credentials:"include"}).catch(()=>{});' +
    'fetch("/protected/secret").catch(()=>{});' +
    'fetch("/"+"x".repeat(9000)).catch(()=>{});' +
    'fetch("' + other.origin + '/secret").catch(()=>{});' +
    'fetch("http://private-resource.example/secret").catch(()=>{});' +
    'fetch("/redirect").catch(()=>{});</script><iframe src="/frame" title="Fixture frame"></iframe>', routes: {
      '/style.css': (_req, res) => { res.writeHead(200, { 'content-type': 'text/css', 'set-cookie': 'secret=PRIVATE_COOKIE' }); res.end('body{color:#164e63}'); },
      '/after-cookie': (_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); },
      '/redirect': (_req, res) => { res.writeHead(302, { location: other.origin + '/redirect-secret' }); res.end(); }
    } });
  t.mock.method(dns, 'lookup', async hostname => {
    assert.equal(hostname, 'private-resource.example');
    return [{ address: '192.168.1.2', family: 4 }];
  });
  const report = await lighthouse.run(site.origin + '/', website.auditOptions(site.origin + '/'));
  assert.equal(report.status, 'partial', report.reason);
  assert.equal(report.reason, 'LIGHTHOUSE_NETWORK_INCOMPLETE');
  assert.equal(report.categories.length, 4);
  assert.ok(report.categories.every(category => Number.isFinite(category.score)));
  const refusals = report.network.records.filter(entry => entry.reason).map(entry => entry.reason);
  for (const reason of ['LIGHTHOUSE_METHOD_BLOCKED', 'PORT_NOT_ALLOWED', 'ROBOTS_UNKNOWN', 'LIGHTHOUSE_SUBFRAME_BLOCKED', 'ROBOTS_BLOCKED']) {
    assert.ok(refusals.includes(reason), reason + ': ' + JSON.stringify(refusals));
  }
  assert.equal(other.requests.length, 0);
  assert.ok(report.network.records.some(entry => entry.urlTruncated && entry.url.length === 8192));
  assert.ok(report.network.records.every(entry => !entry.url || entry.url.length <= 8192));
  assert.ok(!site.requests.some(request => ['/write', '/frame', '/protected/secret'].includes(request.path)));
  assert.ok(site.requests.some(request => request.path === '/after-cookie'));
  assert.ok(site.requests.every(request => request.method === 'GET' && !request.headers.cookie && !request.headers.authorization));
  assert.ok(!JSON.stringify(report).includes('PRIVATE_COOKIE'));
});

test('oversized native assets disclose partial coverage and reserved bytes without exceeding resource allocation', { timeout: 150000 }, async t => {
  const site = await start(t, { routes: {
    '/huge.css': (_req, res) => { res.writeHead(200, { 'content-type': 'text/css', 'content-length': lighthouse.limits.maxResourceBytes + 1 }); res.end(); }
  } });
  site.routes.set('/', (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(markup('Bounded asset fixture', '<p>Visible page.</p>', '<link rel="stylesheet" href="/huge.css">'));
  });
  const report = await lighthouse.run(site.origin + '/', website.auditOptions(site.origin + '/'));
  assert.equal(report.status, 'partial', report.reason);
  assert.ok(report.network.records.some(entry => entry.url.endsWith('/huge.css') && entry.reason === 'RESPONSE_TOO_LARGE'));
  assert.ok(report.network.bytes < report.network.budgetBytes);
  assert.ok(report.network.budgetBytes <= lighthouse.limits.maxTotalBytes);
});

test('unbounded resource fan-out stops at the native Lighthouse request cap, closes the browser and exposes no stale scores', { timeout: 120000 }, async t => {
  const site = await start(t, { scripts: '<script>for(let i=0;i<400;i++)fetch("/many?i="+i).catch(()=>{});</script>' });
  const launch = puppeteer.launch.bind(puppeteer);
  let browser;
  t.mock.method(puppeteer, 'launch', async options => { browser = await launch(options); return browser; });
  const report = await lighthouse.run(site.origin + '/', website.auditOptions(site.origin + '/'));
  assert.equal(report.reason, 'LIGHTHOUSE_REQUEST_LIMIT');
  assert.equal(report.status, 'not-checked');
  assert.deepEqual(report.categories, []);
  assert.equal(browser.connected, false);
  assert.ok(site.requests.filter(request => request.path.startsWith('/many?')).length < lighthouse.limits.maxRequests);
});
