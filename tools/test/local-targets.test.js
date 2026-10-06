const test = require('node:test');
const assert = require('node:assert/strict');
const website = require('../../app/data/website.data');
const audit = require('../../app/service/audit.service');
const { start } = require('./helpers/development-site');
const { start: checker } = require('./helpers/local-server');
const { stubTransport } = require('./helpers/transport');

test('local permission is derived from the explicitly selected origin, pins loopback and does not broaden default public transport', async t => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
    const value = 'http://' + hostname + ':5173/path?x=1#heading';
    const options = website.auditOptions(value, { checkerPort: 3000 });
    const parsed = website.parseUrl(value, options);
    assert.equal(parsed.href, value.split('#')[0]);
    const addresses = await website.resolvePublicTarget(parsed, new AbortController().signal, options);
    assert.equal(addresses[0].address, hostname === '[::1]' ? '::1' : '127.0.0.1');
    assert.throws(() => website.auditOptions('http://' + hostname + ':3000/', { checkerPort: 3000 }), { code: 'CHECKER_TARGET' });
  }
  const options = website.auditOptions('https://public.example/', { localOrigin: 'http://localhost:5173' });
  assert.equal(options.localOrigin, undefined);
  for (const value of ['http://user:secret@localhost:5173/', 'file:///secret', 'http://localhost:5173.attacker.example/']) {
    assert.throws(() => website.auditOptions(value));
  }
  const transport = stubTransport(t);
  await assert.rejects(website.fetchPage('http://localhost/'), { code: 'PRIVATE_TARGET' });
  await assert.rejects(website.fetchPage('http://127.0.0.1:5173/'), { code: 'PORT_NOT_ALLOWED' });
  assert.equal(transport.calls.length, 0);
});

test('native localhost crawl reads links, sitemap-only pages, canonical and actual 404 evidence with no invented port restrictions', async t => {
  const site = await start(t);
  const outcome = await audit.create({ url: site.origin + '/', crawl: true });
  assert.equal(outcome.ok, true);
  const report = outcome.data;
  assert.equal(report.scope.environment, 'local-development');
  assert.equal(report.pages.length, 4);
  assert.ok(report.pages.some(page => page.finalUrl === site.origin + '/sitemap-only'));
  assert.ok(report.siteChecks.some(check => check.ruleId === 'canonical-target' && check.details.target === site.origin + '/'));
  const broken = report.issues.find(issue => issue.ruleId === 'internal-link-target');
  assert.equal(broken.details.httpStatus, 404);
  assert.equal(broken.details.target, site.origin + '/missing');
  assert.equal(report.discovery.sitemaps[0].entries[0].url, site.origin + '/sitemap-only');
  assert.ok(site.requests.every(request => request.method === 'GET' && !request.headers.cookie && !request.headers.authorization));
  assert.equal(report.lighthouse.reason, 'not-requested');
});

test('native IPv4/IPv6 development targets and same-origin redirects are usable, not just syntactically accepted', async t => {
  for (const host of ['127.0.0.1', '::1']) {
    const site = await start(t, { host });
    const origin = host === '127.0.0.1' ? site.origin.replace('localhost', host) : site.origin;
    site.routes.set('/redirect', (_req, res) => { res.writeHead(302, { location: '/child' }); res.end(); });
    const outcome = await audit.create({ url: origin + '/redirect' });
    assert.equal(outcome.ok, true, outcome.code);
    assert.equal(outcome.data.scope.environment, 'local-development');
    assert.equal(outcome.data.pages[0].finalUrl, origin + '/child');
    assert.equal(outcome.data.pages[0].redirects[0].destination, origin + '/child');
  }
});

test('local redirects cannot switch port, alias, public origin or internal addresses, and public redirects cannot gain local permission', async t => {
  const site = await start(t);
  const other = await start(t);
  for (const destination of [other.origin + '/secret', site.origin.replace('localhost', '127.0.0.1') + '/secret',
    'https://public.example/', 'http://169.254.169.254/latest/meta-data']) {
    site.routes.set('/redirect', (_req, res) => { res.writeHead(302, { location: destination }); res.end(); });
    const outcome = await audit.create({ url: site.origin + '/redirect' });
    assert.equal(outcome.ok, false);
    assert.ok(['OUTSIDE_SCOPE', 'PORT_NOT_ALLOWED'].includes(outcome.code), outcome.code);
  }
  assert.equal(other.requests.length, 0);
  const transport = stubTransport(t, [{ status: 302, headers: { location: site.origin + '/secret' } }]);
  const outcome = await audit.create({ url: 'https://public.example/', localOrigin: site.origin, allowPrivate: true });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, 'PORT_NOT_ALLOWED');
  assert.equal(transport.calls.length, 1);
});

test('native local JavaScript rendering executes same-origin files without admitting other local services', async t => {
  const other = await start(t);
  const site = await start(t, { scripts: '<script src="/app.js"></script>', routes: {
    '/app.js': (_req, res) => { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end('document.title="Rendered locally"; fetch("' + other.origin + '/secret").catch(()=>{});'); }
  } });
  const outcome = await audit.create({ url: site.origin + '/', render: true });
  assert.equal(outcome.ok, true);
  const rendered = outcome.data.pages[0].render;
  assert.equal(rendered.after.title, 'Rendered locally');
  assert.equal(rendered.status, 'partial');
  assert.equal(other.requests.length, 0);
});

test('actual checker API rejects its own listening port and still blocks other private networks without reading or logging input', async t => {
  const app = await checker(t);
  for (const url of [app.origin + '/', app.origin.replace('127.0.0.1', 'localhost') + '/']) {
    const response = await fetch(app.origin + '/api/audits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'CHECKER_TARGET');
  }
  const response = await fetch(app.origin + '/api/audits', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'http://192.168.1.1/', localOrigin: 'http://192.168.1.1', allowPrivate: true }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'PRIVATE_TARGET');
  assert.equal(app.logs().stderr, '');
});
