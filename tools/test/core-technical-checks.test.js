const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const audit = require('../../app/service/audit.service');
const core = require('../../app/model/core-technical-checks.model');
const normalize = require('../../app/service/lighthouse-result.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, report, good, bad, clickExport } = require('./helpers/frontend');
const { base, lhr, stubLighthouse } = require('./helpers/lighthouse');

function engine(changes = {}) {
  const source = lhr();
  source.categories['best-practices'].auditRefs = [{ id: 'doctype' }, { id: 'errors-in-console' }];
  source.categories.seo.auditRefs = [{ id: 'document-title' }, { id: 'structured-data' }];
  source.categories['agentic-browsing'] = { categoryScoreDisplayMode: 'fraction', auditRefs: [
    'agent-accessibility-tree', 'cumulative-layout-shift', 'llms-txt', 'ard-schema', 'webmcp-registered-tools', 'webmcp-schema-validity', 'webmcp-form-coverage'
  ].map(id => ({ id })) };
  source.audits = {
    doctype: { title: 'Document doctype', description: 'Add the HTML doctype.', scoreDisplayMode: 'binary', score: 0 },
    'errors-in-console': { title: 'Console errors', scoreDisplayMode: 'error', errorMessage: 'PRIVATE_ERROR' },
    'document-title': { title: 'Document title', scoreDisplayMode: 'binary', score: 1 },
    'structured-data': { title: 'Structured data', scoreDisplayMode: 'manual' },
    'agent-accessibility-tree': { title: 'Accessible agent tree', scoreDisplayMode: 'binary', score: 0,
      details: { type: 'table', items: [{ node: { type: 'node', selector: 'button', snippet: '<button></button>' } }] } },
    'cumulative-layout-shift': { title: 'CLS', scoreDisplayMode: 'numeric', score: 1 },
    'llms-txt': { title: 'llms.txt', scoreDisplayMode: 'notApplicable', score: 1 },
    'ard-schema': { title: 'AI catalog', scoreDisplayMode: 'error', errorMessage: 'PRIVATE_ERROR' },
    'webmcp-registered-tools': { title: 'WebMCP tools', scoreDisplayMode: 'informative' },
    'webmcp-schema-validity': { title: 'WebMCP schema', scoreDisplayMode: 'notApplicable', score: 1 },
    'webmcp-form-coverage': { title: 'WebMCP forms', scoreDisplayMode: 'notApplicable', score: 1 },
    ...changes
  };
  return source;
}

function checklist(source, lighthouse) {
  return core.analyze({ page: source.pages[0], pages: source.pages, checks: source.pages.flatMap(page => page.checks),
    siteFiles: source.siteFiles, lighthouse });
}

test('real file observations are the first core checks after scope, with actionable advice and unchanged issue counters/request count', async t => {
  const transport = stubTransport(t, [{ html: bad }, { status: 404 }, { status: 404 }]);
  const outcome = await audit.create({ url: base, discover: true });
  assert.equal(outcome.ok, true);
  const result = outcome.data;
  const keys = Object.keys(result);
  assert.equal(keys[keys.indexOf('scope') + 1], 'core_technical_checks');
  const files = result.core_technical_checks.slice(0, 2);
  assert.deepEqual(files.map(file => [file.id, file.status]), [['robots-file', 'missing'], ['sitemap-file', 'missing']]);
  for (const [index, file] of files.entries()) {
    assert.deepEqual(file.evidence, result.siteFiles[index].evidence);
    assert.equal(file.evidence[0].httpStatus, 404);
    assert.ok(file.steps.length && file.recommendation);
    assert.ok(!result.issues.some(issue => issue.ruleId === file.id));
  }
  assert.equal(result.summary.checks.fail, result.issues.filter(issue => issue.outcome === 'fail').length);
  assert.equal(transport.calls.length, 3);
});

test('custom sitemaps are found while fallback HTML, failed fetches and access restrictions are not reported as missing', async t => {
  const xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + base + '</loc></url></urlset>';
  stubTransport(t, [{ html: good }, { html: 'User-agent: *\nSitemap: ' + base + 'custom.xml' },
    { html: xml, headers: { 'content-type': 'application/xml' } }, { status: 404 }]);
  const result = (await audit.create({ url: base, discover: true })).data;
  assert.deepEqual(result.core_technical_checks.slice(0, 2).map(file => file.status), ['found', 'found']);
  assert.ok(result.core_technical_checks[1].evidence.some(proof => proof.sourceUrl === base + 'custom.xml' && proof.httpStatus === 200));
  t.mock.restoreAll();
  for (const status of [403, 429, 503]) {
    stubTransport(t, [{ html: good }, { status }, { status }]);
    const outcome = await audit.create({ url: base, discover: true });
    assert.equal(outcome.ok, true);
    assert.ok(outcome.data.core_technical_checks.slice(0, 2).every(file => file.status === 'unavailable'));
    t.mock.restoreAll();
  }
  stubTransport(t, [{ html: good }, { html: '<html>Fallback</html>', headers: { 'content-type': 'text/html' } },
    { html: '<html>Fallback</html>', headers: { 'content-type': 'text/html' } }]);
  assert.ok((await audit.create({ url: base, discover: true })).data.core_technical_checks.slice(0, 2).every(file => file.status === 'invalid'));
});

test('aggregate failures keep exact issue IDs and disclosed incomplete evidence; absence of an audit is never a pass', () => {
  const source = report(base, bad);
  const alt = source.pages[0].checks.find(check => check.ruleId === 'image-alt');
  alt.complete = false;
  const original = JSON.stringify(source);
  const rows = checklist(source);
  const finding = rows.find(row => row.id === 'image-alt');
  assert.equal(finding.status, 'fail');
  assert.equal(finding.complete, false);
  assert.deepEqual(finding.issueIds, [alt.id]);
  assert.deepEqual(finding.steps, alt.steps);
  assert.equal(rows.find(row => row.id === 'canonical-target').status, 'not-checked');
  assert.equal(rows.find(row => row.id === 'lighthouse:is-on-https').status, 'not-checked');
  assert.ok(rows.filter(row => row.group === 'agentic').every(row => row.status === 'not-checked' && row.reason));
  assert.equal(JSON.stringify(source), original);
  source.pages[0].checks.unshift({ ...alt, id: 'alt-review', outcome: 'review', found: 'Needs confirmation', steps: ['Confirm first'] });
  const mixed = checklist(source).find(row => row.id === 'image-alt');
  assert.equal(mixed.status, 'fail');
  assert.equal(mixed.found, alt.found);
  assert.deepEqual(mixed.steps, alt.steps);
  assert.deepEqual(mixed.issueIds, ['alt-review', alt.id]);
});

test('no JSON-LD is a scoped N/A, syntax never proves semantics, and static pages do not pretend to have run JavaScript', () => {
  const source = report(base, good, { render: { status: 'not-checked', reason: 'no-executable-script' } });
  const rows = checklist(source);
  assert.equal(rows.find(row => row.id === 'jsonld-syntax').status, 'not-applicable');
  assert.equal(rows.find(row => row.id === 'jsonld-semantics').status, 'not-checked');
  const render = rows.find(row => row.id === 'javascript-render');
  assert.equal(render.status, 'not-applicable');
  assert.ok(render.found.includes('JavaScript 0'));
});

test('Lighthouse technical results preserve fail/manual/N/A/unavailable outcomes and bounded evidence, never provider errors or unrelated bodies', () => {
  const source = engine({ doctype: { title: '<img onerror=alert(1)>', description: 'Fix the doctype.', scoreDisplayMode: 'binary', score: 0,
    details: { type: 'table', items: Array.from({ length: 40 }, () => ({ message: 'x'.repeat(2000),
      body: 'PRIVATE_BODY', node: { selector: 'html', snippet: '<html>' + 'x'.repeat(3000), html: 'PRIVATE_BODY' } })) },
    errorMessage: 'PRIVATE_ERROR', html: 'PRIVATE_BODY' } });
  const normalized = normalize.format({ status: 'received', data: { lighthouseResult: source } }, base);
  const rows = normalized.technicalChecks;
  assert.equal(rows.find(row => row.id === 'doctype').status, 'fail');
  assert.equal(rows.find(row => row.id === 'structured-data').status, 'manual');
  assert.equal(rows.find(row => row.id === 'errors-in-console').status, 'not-checked');
  assert.equal(rows.find(row => row.id === 'doctype').evidence.length, 20);
  assert.equal(rows.find(row => row.id === 'doctype').evidenceTruncated, true);
  assert.ok(rows.find(row => row.id === 'doctype').evidence.every(item => item.message.length <= 1024 && item.snippet.length <= 2048));
  assert.ok(!JSON.stringify(normalized).includes('PRIVATE_ERROR') && !JSON.stringify(normalized).includes('PRIVATE_BODY'));
  source.categories.seo.auditRefs = { malicious: true };
  source.categories['best-practices'].auditRefs = [];
  assert.doesNotThrow(() => normalize.format({ status: 'received', data: { lighthouseResult: source } }, base));
});

test('Agentic core rows retain single-URL engine outcomes and actual node evidence without inventing missing files, scores or full-site coverage', () => {
  const normalized = normalize.format({ status: 'received', data: { lighthouseResult: engine() } }, base);
  const rows = checklist(report(base, good), normalized);
  const tree = rows.find(row => row.id === 'agentic:agent-accessibility-tree');
  assert.equal(tree.status, 'fail');
  assert.ok(tree.steps.length && tree.evidence[0].snippet === '<button></button>');
  assert.equal(tree.scope, 'single-url');
  assert.equal(tree.url, normalized.finalUrl);
  assert.equal(rows.find(row => row.id === 'agentic:llms-txt').status, 'not-applicable');
  assert.ok(rows.find(row => row.id === 'agentic:llms-txt').recommendation);
  assert.equal(rows.find(row => row.id === 'agentic:ard-schema').status, 'not-checked');
  assert.ok(!JSON.stringify(rows).includes('PRIVATE_ERROR'));
  const runtime = normalize.format({ status: 'received', data: { lighthouseResult: { ...engine(), runtimeError: { message: 'PRIVATE_ERROR' } } } }, base);
  assert.ok(checklist(report(base, good), runtime).filter(row => row.group === 'agentic' || row.group.startsWith('lighthouse-')).every(row => row.status === 'not-checked'));
});

test('excessive Lighthouse audit references have an explicit unavailable coverage row instead of silently claiming complete category coverage', () => {
  const source = engine();
  source.categories.seo.auditRefs = Array.from({ length: 200 }, (_, index) => ({ id: 'audit-' + index }));
  const normalized = normalize.format({ status: 'received', data: { lighthouseResult: source } }, base);
  const limited = normalized.technicalChecks.find(row => row.id === 'seo-audit-coverage');
  assert.equal(limited.status, 'not-checked');
  assert.equal(limited.reason, 'audit-ref-limit');
  assert.ok(normalized.technicalChecks.length <= 107);
});

async function download(page, selector) {
  const event = page.waitForEvent('download');
  await clickExport(page, selector);
  const chunks = [];
  for await (const chunk of await (await event).createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('actual API/UI shows the checklist, escapes engine evidence, opens corrective issues and exports the same full-round context in both formats/scopes', { timeout: 40000 }, async t => {
  stubTransport(t, [{ html: bad }, { status: 404 }, { status: 404 }, { html: good }, { status: 404 }]);
  const source = engine({ doctype: { title: '<img src=x onerror=globalThis.__coreXss=true>', description: 'Fix the doctype.', scoreDisplayMode: 'binary', score: 0,
    details: { type: 'table', items: [{ node: { selector: 'html', snippet: '<script>globalThis.__coreXss=true</script>' } }] } } });
  stubLighthouse(t, [source]);
  let result;
  const create = audit.create;
  t.mock.method(audit, 'create', async (...args) => { const outcome = await create(...args); result = outcome.data; return outcome; });
  const { page, errors } = await frontend(t);
  await scan(page, base, { discover: true, lighthouse: true });
  assert.equal(await page.locator('#core-technical-section').isVisible(), true);
  assert.equal(await page.locator('[data-file-status="missing"]').count(), 2);
  await page.locator('#core-technical-section > summary').click();
  await page.locator('[data-core-check="lighthouse:doctype"] > summary').click();
  assert.equal(await page.locator('#core-technical-list img, #core-technical-list script').count(), 0);
  assert.equal(await page.evaluate(() => globalThis.__coreXss), undefined);
  assert.ok((await page.locator('[data-core-check="lighthouse:doctype"]').textContent()).includes('Fix the doctype.'));
  await page.locator('[data-core-check="image-alt"] > summary').click();
  await page.locator('[data-core-issue-id="image-alt"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  assert.ok((await page.locator('#detail-content').textContent()).includes(result.issues.find(issue => issue.id === 'image-alt').steps[0]));
  await page.locator('#issue-drawer .btn-close').click();
  await page.locator('#issue-drawer').waitFor({ state: 'hidden' });
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#core-technical-section').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SEO_CORE_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-core-' + width + '.png') });
  }
  await page.locator('#issue-search').fill('image-alt');
  for (const selector of ['#export-json-button', '#export-button']) {
    const exported = JSON.parse((await download(page, selector)).toString('utf8'));
    assert.deepEqual(exported.core_technical_checks, result.core_technical_checks);
  }
  for (const selector of ['#export-xlsx-button', '#export-issues-xlsx-button']) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await download(page, selector));
    const sheet = workbook.getWorksheet('Core Technical');
    assert.equal(sheet.rowCount, result.core_technical_checks.length + 1);
    assert.equal(sheet.getCell('A2').value, 'robots-file');
    assert.equal(sheet.getCell('D2').value, 'missing');
    assert.deepEqual(JSON.parse(sheet.getCell('N2').value), result.core_technical_checks[0].evidence);
  }
  await scan(page, base + 'next', { discover: false });
  assert.equal(await page.locator('#core-technical-section').getAttribute('open'), null);
  await page.locator('#core-technical-section > summary').click();
  assert.ok(!(await page.locator('#core-technical-list').textContent()).includes('globalThis.__coreXss'));
  assert.equal(await page.locator('[data-core-check="agentic:agent-accessibility-tree"]').getAttribute('data-core-status'), 'not-checked');
  await page.reload();
  assert.equal(await page.locator('#core-technical-section').isVisible(), false);
  assert.equal(await page.locator('#core-technical-list').textContent(), '');
  assert.deepEqual(errors, []);
});
