const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const ExcelJS = require('exceljs');
const { createWorkbook, limits } = require('../../assets/js/report-export');
const { frontend, scan, report, bad, good, clickExport } = require('./helpers/frontend');

function exported(source, scope = 'entire-round') {
  return { ...source, export: { format: 'seo-checker-json', scope, exportedAt: new Date().toISOString() } };
}

async function downloaded(page, selector) {
  const event = page.waitForEvent('download');
  await clickExport(page, selector);
  const item = await event;
  const stream = await item.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { data: Buffer.concat(chunks), filename: item.suggestedFilename() };
}

async function readWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return workbook;
}

test('XLSX round-trips actual report tables, all affected URLs and evidence without inventing scores or changing JSON', async () => {
  const source = exported(report('https://fixture.example/', bad));
  source.issues[0].urls.push('https://fixture.example/another');
  const original = JSON.stringify(source);
  const workbook = await readWorkbook(await createWorkbook(source, ExcelJS).xlsx.writeBuffer());
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Summary', 'Core Technical', 'Pages', 'Issues', 'Issue URLs', 'Evidence', 'Scores', 'Agentic', 'Not Checked', 'Discovered', 'Skipped']);
  assert.equal(workbook.getWorksheet('Pages').getCell('B2').value, source.pages[0].finalUrl);
  assert.equal(workbook.getWorksheet('Pages').getCell('F2').value, source.pages[0].metadata.title);
  assert.equal(workbook.getWorksheet('Issues').rowCount, source.issues.length + 1);
  assert.equal(workbook.getWorksheet('Issues').getCell('A2').value, source.issues[0].id);
  assert.deepEqual(JSON.parse(workbook.getWorksheet('Issues').getCell('J2').value), source.issues[0].steps);
  assert.equal(workbook.getWorksheet('Issue URLs').rowCount, source.issues.reduce((sum, issue) => sum + issue.urls.length, 1));
  assert.deepEqual(JSON.parse(workbook.getWorksheet('Evidence').getCell('G2').value), source.issues[0].evidence[0]);
  assert.equal(workbook.getWorksheet('Scores').rowCount, 1);
  assert.equal(workbook.getWorksheet('Not Checked').rowCount, source.notChecked.length + 1);
  assert.equal(workbook.getWorksheet('Issues').views[0].ySplit, 1);
  assert.ok(workbook.getWorksheet('Issues').autoFilter);
  assert.equal(JSON.stringify(source), original);
});

test('spreadsheet cells neutralize formula prefixes and encode XML controls while JSON retains exact source values', async () => {
  const source = exported(report('https://fixture.example/', bad));
  source.issues[0].title = '=HYPERLINK("https://untrusted.example", "label"),\nnext';
  source.issues[0].found = '\t@SUM(1+1)';
  source.issues[0].impact = '\uff1d1+1';
  source.issues[0].reason = 'before\u0000after\uffff';
  const original = JSON.stringify(source);
  const workbook = await readWorkbook(await createWorkbook(source, ExcelJS).xlsx.writeBuffer());
  const sheet = workbook.getWorksheet('Issues');
  assert.equal(sheet.getCell('G2').value, "'" + source.issues[0].title);
  assert.equal(sheet.getCell('H2').value, "'\t@SUM(1+1)");
  assert.equal(sheet.getCell('I2').value, "'\uff1d1+1");
  assert.equal(sheet.getCell('L2').value, 'before\\u0000after\\uffff');
  for (const cell of ['G2', 'H2', 'I2', 'L2']) assert.equal(sheet.getCell(cell).type, ExcelJS.ValueType.String);
  workbook.eachSheet(worksheet => worksheet.eachRow(row => row.eachCell(cell => assert.notEqual(cell.type, ExcelJS.ValueType.Formula))));
  assert.equal(JSON.stringify(source), original);
});

test('Agentic XLSX preserves partial audit statuses, engine fraction and safe evidence without fabricating scores', async () => {
  const source = exported(report('https://fixture.example/', good));
  const lhr = require('./helpers/lighthouse').lhr();
  lhr.categories['agentic-browsing'] = { categoryScoreDisplayMode: 'fraction', auditRefs: [{ id: 'pass' }, { id: 'error' }, { id: 'na' }] };
  lhr.audits = { pass: { title: '=DO_NOT_EXECUTE()', scoreDisplayMode: 'binary', score: 1, details: { type: 'table', items: [{ message: '@safe literal' }] } },
    error: { scoreDisplayMode: 'error', score: null, errorMessage: 'PRIVATE_ERROR' }, na: { scoreDisplayMode: 'notApplicable', score: 1 } };
  source.lighthouse = require('../../app/service/lighthouse-result.service').format({ status: 'received', data: { lighthouseResult: lhr } }, lhr.requestedUrl);
  const original = JSON.stringify(source);
  const workbook = await readWorkbook(await createWorkbook(source, ExcelJS).xlsx.writeBuffer());
  const sheet = workbook.getWorksheet('Agentic');
  assert.equal(sheet.rowCount, 4);
  assert.equal(sheet.getCell('B2').value, "'=DO_NOT_EXECUTE()");
  assert.equal(sheet.getCell('C2').value, 'pass');
  assert.equal(sheet.getCell('D2').value, 1);
  assert.equal(sheet.getCell('C3').value, 'not-checked');
  assert.equal(sheet.getCell('D3').value, '');
  assert.equal(sheet.getCell('E3').value, 'audit-runtime-error');
  assert.equal(sheet.getCell('C4').value, 'not-applicable');
  assert.equal(sheet.getCell('D4').value, '');
  assert.deepEqual(JSON.parse(sheet.getCell('H2').value), [{ message: '@safe literal' }]);
  assert.equal(sheet.getCell('L2').value, lhr.lighthouseVersion);
  assert.equal(source.lighthouse.status, 'partial');
  const summary = workbook.getWorksheet('Summary');
  const fields = new Map(summary.getRows(2, summary.rowCount - 1).map(row => [row.getCell(1).value, row.getCell(2).value]));
  assert.equal(fields.get('Agentic Not Checked'), 1);
  assert.deepEqual(JSON.parse(fields.get('Agentic Engine Fraction')), { passed: 1, total: 2 });
  assert.ok(!JSON.stringify(source.lighthouse).includes('PRIVATE_ERROR'));
  assert.equal(JSON.stringify(source), original);
});

test('long Unicode evidence is preserved in reconstructable JSON chunks instead of silently truncated cells', async () => {
  const source = exported(report('https://fixture.example/', bad));
  const value = 'x'.repeat(4998) + '\ud83d\ude00' + '\n="quoted"\\'.repeat(8000);
  source.issues[0].found = value;
  const workbook = await readWorkbook(await createWorkbook(source, ExcelJS).xlsx.writeBuffer());
  assert.match(workbook.getWorksheet('Issues').getCell('H2').value, /^\[Full text: Long Text/);
  const parts = [];
  workbook.getWorksheet('Long Text').eachRow((row, index) => {
    if (index > 1 && row.getCell(1).value === 'Issues' && row.getCell(2).value === 'H2') parts.push(JSON.parse(row.getCell(4).value));
  });
  assert.equal(parts.join(''), value);
  workbook.eachSheet(worksheet => worksheet.eachRow(row => row.eachCell(cell => {
    if (typeof cell.value === 'string') assert.ok(cell.value.length <= limits.maxCellCharacters);
  })));
  assert.equal(source.issues[0].found, value);
});

test('large workbook projections fail explicitly before row/cell budgets can be exceeded', () => {
  class Workbook {
    addWorksheet() {
      let rows = 0;
      return { set columns(value) { rows = 1; }, get rowCount() { return rows; }, getRow() { return {}; },
        addRow() { ++rows; return { eachCell() {} }; } };
    }
  }
  const source = exported(report('https://fixture.example/', bad));
  source.issues = [{ ...source.issues[0], urls: Array.from({ length: limits.maxRows }, () => 'https://fixture.example/') }];
  assert.throws(() => createWorkbook(source, { Workbook }), { message: 'SPREADSHEET_TOO_LARGE' });
  source.issues = Array.from({ length: 70000 }, () => ({ ...source.issues[0], urls: ['https://fixture.example/'] }));
  assert.throws(() => createWorkbook(source, { Workbook }), { message: 'SPREADSHEET_TOO_LARGE' });
  assert.throws(() => createWorkbook(source), { message: 'SPREADSHEET_LIBRARY_UNAVAILABLE' });
});

test('browser downloads JSON and real XLSX for the same filtered findings, without upload or automatic downloads', async t => {
  const source = report('https://fixture.example/', bad);
  const { page, errors } = await frontend(t, { width: 390, height: 844 });
  let requests = 0;
  let downloads = 0;
  const remote = [];
  page.on('download', () => ++downloads);
  page.on('request', request => { if (request.url().startsWith('https://') && !request.url().startsWith('https://cdn.jsdelivr.net/')) remote.push(request.url()); });
  await page.route('**/api/audits', route => { ++requests; return route.fulfill({ json: source }); });
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    window.exportUrls = []; window.revokedExportUrls = [];
    URL.createObjectURL = blob => { const url = create(blob); window.exportUrls.push(url); return url; };
    URL.revokeObjectURL = url => { window.revokedExportUrls.push(url); revoke(url); };
  });
  await scan(page, source.requestedUrl);
  assert.equal(downloads, 0);
  await page.locator('#issue-search').fill('image-alt');
  const json = await downloaded(page, '#export-button');
  const selected = JSON.parse(json.data.toString('utf8'));
  const xlsx = await downloaded(page, '#export-issues-xlsx-button');
  const workbook = await readWorkbook(xlsx.data);
  assert.equal(selected.issues.length, 1);
  assert.equal(workbook.getWorksheet('Issues').rowCount, 2);
  assert.equal(workbook.getWorksheet('Issues').getCell('A2').value, selected.issues[0].id);
  assert.equal(workbook.getWorksheet('Evidence').rowCount, selected.issues[0].evidence.length + 1);
  assert.deepEqual(JSON.parse(workbook.getWorksheet('Evidence').getCell('G2').value), selected.issues[0].evidence[0]);
  assert.equal(json.filename.replace(/\.json$/, ''), xlsx.filename.replace(/\.xlsx$/, ''));
  assert.equal(workbook.getWorksheet('Pages'), undefined);
  const full = await readWorkbook((await downloaded(page, '#export-xlsx-button')).data);
  assert.equal(full.getWorksheet('Pages').rowCount, source.pages.length + 1);
  assert.equal(full.getWorksheet('Issues').rowCount, source.issues.length + 1);
  assert.equal(requests, 1);
  await page.waitForFunction(() => window.exportUrls.every(url => window.revokedExportUrls.includes(url)));
  assert.equal(await page.evaluate(() => window.exportUrls.length), 3);
  assert.deepEqual(remote, []);
  assert.equal(await page.locator('button').filter({ hasText: 'CSV' }).count(), 0);
  const tempRoot = path.resolve(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(tempRoot, 'seo-spreadsheet-preview-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), tempRoot);
    return fs.rm(directory, { recursive: true, force: true });
  });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(directory, width + '.png') });
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector('header svg'));
  assert.equal(await page.locator('#report').isVisible(), false);
  for (const id of ['export-menu-button', 'export-button', 'export-json-button', 'export-xlsx-button', 'export-issues-xlsx-button']) assert.equal(await page.locator('#' + id).isDisabled(), true);
  assert.equal(downloads, 3);
  assert.deepEqual(errors, []);
});

test('zero-issue and unconfigured-score reports still produce honest full XLSX tables', async t => {
  const source = report('https://fixture.example/', good);
  const { page, errors } = await frontend(t);
  await page.route('**/api/audits', route => route.fulfill({ json: source }));
  await scan(page, source.requestedUrl);
  assert.equal(await page.locator('#export-issues-xlsx-button').isDisabled(), true);
  const workbook = await readWorkbook((await downloaded(page, '#export-xlsx-button')).data);
  assert.equal(workbook.getWorksheet('Issues').rowCount, 1);
  assert.equal(workbook.getWorksheet('Pages').rowCount, 2);
  assert.equal(workbook.getWorksheet('Scores').rowCount, 1);
  assert.ok(workbook.getWorksheet('Not Checked').rowCount > 1);
  assert.deepEqual(errors, []);
});

test('missing writer and generation failures keep JSON available, show no raw private error and never download corrupt workbooks', async t => {
  const source = report('https://fixture.example/', bad);
  const { page, errors } = await frontend(t);
  let downloads = 0;
  page.on('download', () => ++downloads);
  await page.route('**/api/audits', route => route.fulfill({ json: source }));
  await scan(page, source.requestedUrl);
  await page.evaluate(() => { window.ExcelJS = undefined; });
  await clickExport(page, '#export-xlsx-button');
  await page.waitForFunction(() => !document.querySelector('#export-xlsx-button').disabled);
  assert.ok((await page.locator('#app-message').textContent()).includes('JSON'));
  await page.evaluate(() => { window.SEOReportExport.createWorkbook = () => { throw new Error('PRIVATE_MARKER'); }; });
  await clickExport(page, '#export-xlsx-button');
  await page.waitForFunction(() => !document.querySelector('#export-xlsx-button').disabled);
  assert.ok(!(await page.locator('#app-message').textContent()).includes('PRIVATE_MARKER'));
  assert.equal(downloads, 0);
  assert.equal(JSON.parse((await downloaded(page, '#export-json-button')).data.toString('utf8')).requestedUrl, source.requestedUrl);
  assert.deepEqual(errors, []);
});

test('pending XLSX from an older round cannot download or re-enable controls after a new round or pagehide', async t => {
  const first = report('https://fixture.example/first', bad), second = report('https://fixture.example/second', good);
  const { page, errors } = await frontend(t);
  let downloads = 0;
  page.on('download', () => ++downloads);
  await page.route('**/api/audits', route => route.fulfill({ json: route.request().postDataJSON().url === first.requestedUrl ? first : second }));
  await scan(page, first.requestedUrl);
  await page.evaluate(() => {
    window.SEOReportExport.createWorkbook = () => ({ xlsx: { writeBuffer: () => new Promise(resolve => { window.finishExport = () => resolve(new Uint8Array([80, 75])); }) } });
  });
  await clickExport(page, '#export-xlsx-button');
  await page.waitForFunction(() => typeof window.finishExport === 'function');
  assert.equal(await page.locator('#export-xlsx-button').isDisabled(), true);
  await scan(page, second.requestedUrl);
  await page.evaluate(() => window.finishExport());
  await page.waitForTimeout(100);
  assert.equal(downloads, 0);
  assert.equal(await page.locator('#report-host').textContent(), second.requestedUrl);
  assert.equal(await page.locator('#export-xlsx-button').isDisabled(), false);
  await clickExport(page, '#export-xlsx-button');
  await page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.finishExport(); });
  await page.waitForTimeout(100);
  assert.equal(downloads, 0);
  assert.equal(await page.locator('#export-xlsx-button').isDisabled(), true);
  assert.deepEqual(errors, []);
});
