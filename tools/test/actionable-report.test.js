const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const model = require('../../app/model/audit.model');
const html = require('../../app/service/html.service');
const seo = require('../../app/service/seo.service');
const development = require('./helpers/development-site');
const { frontend, scan, clickExport } = require('./helpers/frontend');

const origin = 'https://fixture.example';
const markers = ['UNRELATED_BODY_PRIVATE', 'UNRELATED_SCRIPT_PRIVATE', 'UNRELATED_HEADER_PRIVATE', 'UNRELATED_INTERNAL_PRIVATE'];
function page(source) {
  const value = { requestedUrl: origin + '/', finalUrl: origin + '/', html: source, status: 200,
    bytes: Buffer.byteLength(source), headers: { 'x-debug': markers[2] }, rawHeaders: ['X-Debug', markers[2]], redirects: [],
    robots: { status: 'absent', googlebotAllowed: true, crawlerAllowed: true, url: origin + '/robots.txt' } };
  value.metadata = html.parse(value);
  value.checks = seo.analyze(value);
  return value;
}

test('public report excludes source documents and internal fields without changing findings, actions or bounded evidence', () => {
  const value = page('<title>Repair fixture</title><img src="/missing-alt.png"><p>' + markers[0] + '</p><script>' + markers[1] + '</script>');
  value.internal = markers[3];
  value.metadata.internal = markers[3];
  const observation = { title: 'Observed title', description: '', canonical: [], h1: ['Observed heading'], metadataComplete: true,
    html: markers[0], internal: markers[3], text: { length: 17, preview: markers[0], sha256: markers[3] } };
  value.render = { status: 'partial', complete: false, indexing: { status: 'not-checked' }, before: observation, after: observation,
    internal: markers[3], resources: { records: [{ url: origin + '/app.js', reason: 'OUTSIDE_SCOPE', body: markers[1] }], omitted: 2 } };
  const initial = JSON.stringify(value);
  const discovery = { origin, urls: [{ url: value.finalUrl, sources: [] }], skipped: [], skippedOmitted: 0,
    linkExtractionComplete: true, limitReached: false, internal: markers[3], sitemaps: [{ url: origin + '/sitemap.xml',
      status: 'checked', totalEntries: 1, truncated: false, entries: [{ url: value.finalUrl, source: markers[3] }], text: markers[0] }] };
  const response = { url: value.finalUrl, status: 200, terminal: true, headers: value.headers, rawHeaders: value.rawHeaders,
    html: value.html, body: markers[0], internal: markers[3], redirects: [{ url: origin, status: 301, destination: value.finalUrl, html: markers[0] }] };
  const result = model.createReport(value, '2026-01-01T00:00:00Z', discovery,
    { pages: [value], responses: [response], skipped: [], stats: {}, limits: {}, stopReason: null });
  const output = result.pages[0];
  assert.equal(result.schemaVersion, '2.0');
  assert.deepEqual(output.checks.map(check => check.ruleId), value.checks.map(check => check.ruleId));
  assert.deepEqual(result.issues.map(issue => issue.ruleId), value.checks.filter(check => ['fail', 'review'].includes(check.outcome)).map(check => check.ruleId));
  const alt = result.issues.find(issue => issue.ruleId === 'image-alt');
  assert.deepEqual(alt.evidence, value.checks.find(check => check.ruleId === 'image-alt').evidence);
  assert.ok(alt.steps.length && alt.evidence[0].source.includes('<img') && alt.evidence[0].location.startLine);
  for (const marker of markers) assert.equal(JSON.stringify(result).includes(marker), false, marker);
  for (const key of ['html', 'headers', 'rawHeaders', 'internal']) assert.equal(Object.hasOwn(output, key), false);
  for (const key of ['meta', 'links', 'images', 'titles', 'descriptions', 'internal']) assert.equal(Object.hasOwn(output.metadata, key), false);
  assert.deepEqual(output.render.after.text, { length: 17 });
  assert.equal(result.discovery.sitemaps[0].entries, undefined);
  assert.equal(result.responses[0].headers, undefined);
  assert.equal(result.responses[0].redirects[0].html, undefined);
  assert.equal(JSON.stringify(value), initial);
});

test('removing raw parser data preserves unavailable checks, extraction counts and partial render coverage', () => {
  const value = page('<meta name="unrelated" content="x">'.repeat(5000) + '<meta property="og:title" content="Beyond cap">');
  value.render = { status: 'not-checked', reason: 'RENDER_PAGE_LIMIT', indexing: { status: 'not-checked', reason: 'not-search-engine-observation' } };
  const result = model.createReport(value, '2026-01-01T00:00:00Z');
  assert.equal(result.pages[0].metadata.openGraph.complete, false);
  assert.equal(result.pages[0].metadata.counts.meta, 5001);
  assert.deepEqual(result.pages[0].metadata.truncated, ['meta']);
  assert.equal(result.pages[0].metadata.meta, undefined);
  assert.equal(result.pages[0].analysisStatus, 'partial');
  assert.ok(result.notChecked.some(entry => entry.id === 'open-graph' && entry.reason === 'metadata-limit'));
  assert.ok(result.notChecked.some(entry => entry.id === 'javascript-render' && entry.reason === 'RENDER_PAGE_LIMIT'));
  assert.ok(!result.issues.some(entry => entry.ruleId === 'open-graph'));
});

test('unrelated document content no longer grows the serialized report with the whole page', () => {
  const document = body => '<title>Repair fixture</title><img src="/missing-alt.png"><p>' + body + '</p>';
  const small = page(document(markers[0]));
  const large = page(document(markers[0].repeat(12000)));
  const results = [small, large].map(value => model.createReport(value, '2026-01-01T00:00:00Z'));
  assert.deepEqual(results[0].issues, results[1].issues);
  assert.ok(Math.abs(JSON.stringify(results[1]).length - JSON.stringify(results[0]).length) < 20);
  assert.ok(large.html.length > 200000);
  assert.equal(JSON.stringify(results[1]).includes(markers[0]), false);
});

async function download(browserPage, selector) {
  const event = browserPage.waitForEvent('download');
  await clickExport(browserPage, selector);
  const stream = await (await event).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('native API/UI and both JSON/XLSX scopes expose actionable issues without full HTML, DOM or unrelated content', async (t) => {
  const document = (base, child) => '<!doctype html><html lang="en"><head><title>Repair fixture</title>' +
    '<meta name="description" content="' + (child ? 'Child page' : 'Root page') + '"><link rel="canonical" href="' + (child ? '/child' : '/') + '">' +
    '<meta property="og:title" content="Repair fixture"><meta property="og:type" content="website">' +
    '<meta property="og:url" content="' + base + (child ? '/child' : '/') + '"><meta property="og:image" content="' + base + '/pixel.png">' +
    '<meta property="og:description" content="Share fixture"></head><body><h1>' + (child ? 'Child heading' : 'Root heading') + '</h1>' +
    '<p id="private">' + markers[0].repeat(2000) + '</p>' + (child ? '' : '<a href="/child">Child</a><img src="/pixel.png">') +
    '<script>window.__privateSource="' + markers[1] + '";document.title+=" rendered";' +
    'document.querySelector("h1").textContent="Rendered heading";document.querySelector("#private").textContent="' + markers[0] + ' after";</script></body></html>';
  const route = child => (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html', 'x-debug': markers[2] });
    res.end(document('http://' + req.headers.host, child));
  };
  const site = await development.start(t, { routes: { '/': route(false), '/child': route(true),
    '/sitemap.xml': (_req, res) => { res.writeHead(404); res.end(); } } });
  const service = require('../../app/service/audit.service');
  const create = service.create;
  let result;
  t.mock.method(service, 'create', async (body, options) => {
    const outcome = await create(body, options);
    result = outcome.data;
    return outcome;
  });
  const { page: browserPage, errors } = await frontend(t);
  const event = browserPage.waitForResponse(response => response.url().endsWith('/api/audits'));
  await scan(browserPage, site.origin + '/', { crawl: true, render: true });
  const response = await event;
  assert.match(response.headers()['content-type'], /^application\/x-ndjson/);
  assert.ok(result);
  assert.equal(result.schemaVersion, '2.0');
  assert.equal(result.pages.length, 2);
  assert.ok(result.issues.some(issue => issue.ruleId === 'duplicate-title' && issue.urls.length === 2));
  const alt = result.issues.find(issue => issue.ruleId === 'image-alt');
  assert.ok(alt && alt.steps.length && alt.evidence[0].source.includes('<img'));
  assert.equal(result.pages[0].render.after.title, 'Repair fixture rendered');
  for (const marker of markers) assert.equal(JSON.stringify(result).includes(marker), false, marker);
  await browserPage.locator('[data-issue-id="' + alt.id + '"]').click();
  await browserPage.locator('#issue-drawer.show').waitFor();
  assert.ok((await browserPage.locator('#detail-content').textContent()).includes(alt.steps[0]));
  assert.equal(await browserPage.locator('[data-evidence-kind="html"] pre code').textContent(), alt.evidence[0].source);
  for (const width of [1280, 320]) {
    await browserPage.setViewportSize({ width, height: 900 });
    await browserPage.waitForFunction(() => {
      const bounds = document.getElementById('issue-drawer').getBoundingClientRect();
      return Math.abs(bounds.right - innerWidth) < 1 && bounds.left >= 0;
    });
    assert.equal(await browserPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SEO_SCREENSHOTS === 'true') await browserPage.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-actionable-' + width + '.png') });
  }
  await browserPage.locator('#issue-drawer .btn-close').click();
  await browserPage.locator('#issue-drawer').waitFor({ state: 'hidden' });
  await browserPage.locator('#pages-tab').click();
  await browserPage.locator('#page-rows [data-page-url]').first().click();
  const comparison = browserPage.locator('[data-render-comparison]');
  assert.ok((await comparison.textContent()).includes('Repair fixture rendered'));
  assert.equal(await comparison.locator('pre').count(), 0);
  assert.ok(!(await browserPage.locator('#detail-content').textContent()).includes(markers[0]));
  await browserPage.locator('#issue-drawer .btn-close').click();
  await browserPage.locator('#issue-drawer').waitFor({ state: 'hidden' });
  await browserPage.locator('#issues-tab').click();
  await browserPage.locator('#issue-search').fill('image-alt');
  const full = JSON.parse((await download(browserPage, '#export-json-button')).toString('utf8'));
  const filtered = JSON.parse((await download(browserPage, '#export-button')).toString('utf8'));
  assert.equal(full.issues.length, result.issues.length);
  const { export: exportMetadata, ...exportedResult } = full;
  assert.equal(exportMetadata.scope, 'entire-round');
  assert.deepEqual(exportedResult, result);
  assert.equal(filtered.issues.length, 1);
  assert.deepEqual(filtered.issues[0], alt);
  for (const entry of [full, filtered]) for (const marker of markers) assert.equal(JSON.stringify(entry).includes(marker), false);
  for (const selector of ['#export-xlsx-button', '#export-issues-xlsx-button']) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await download(browserPage, selector));
    const text = JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()));
    for (const marker of markers) assert.equal(text.includes(marker), false);
    assert.ok(text.includes('missingAlt') && text.includes('pixel.png'));
  }
  assert.ok(site.requests.every(request => request.method === 'GET'));
  await browserPage.reload();
  assert.equal(await browserPage.locator('#report').isVisible(), false);
  assert.equal(await browserPage.locator('#detail-content').textContent(), '');
  assert.deepEqual(errors, []);
});
