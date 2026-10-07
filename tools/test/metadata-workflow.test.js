const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const ExcelJS = require('exceljs');
const development = require('./helpers/development-site');
const { frontend, scan, clickExport } = require('./helpers/frontend');

const document = (password = false) => '<!doctype html><html lang="en"><head><title>Villa Brand</title>' +
  '<meta name="description" content="' + (password ? 'Change account password' : 'Choose a villa') + '">' +
  '<link rel="canonical" href="' + (password ? '/reset-password' : '/') + '">' +
  (password ? '<meta name="robots" content="noindex">' : '') + '</head><body><h1>' +
  (password ? 'Change password &lt;img src=x onerror=&quot;globalThis.__metadataXss=true&quot;&gt;' : 'Browse villas') + '</h1>' +
  (password ? '<form><input type="password" aria-label="New password"></form>' : '<a href="/reset-password">Reset password</a>') + '</body></html>';

async function download(page, selector) {
  const event = page.waitForEvent('download');
  await clickExport(page, selector);
  const stream = await (await event).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('native localhost crawl exposes copied titles and missing OG in UI, keeps context inert/responsive and exports matching JSON/XLSX', async (t) => {
  const site = await development.start(t, { routes: {
    '/': (_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(document()); },
    '/reset-password': (_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(document(true)); },
    '/sitemap.xml': (_req, res) => { res.writeHead(404); res.end(); }
  } });
  const { page, errors } = await frontend(t);
  await scan(page, site.origin + '/', { crawl: true });
  assert.equal(await page.locator('#summary-pages').textContent(), '2');
  assert.equal(await page.locator('#issue-rows tr').count(), 5);
  await page.locator('#issue-rows [data-issue-id^="duplicate-title:"]').click();
  const reuse = page.locator('[data-metadata-reuse]');
  assert.ok((await reuse.textContent()).includes('Browse villas'));
  assert.ok((await reuse.textContent()).includes('Change password'));
  await reuse.locator(':scope > details').evaluateAll(entries => entries.forEach(entry => { entry.open = true; }));
  assert.equal(await reuse.locator('img, script, iframe').count(), 0);
  assert.equal(await page.evaluate(() => globalThis.__metadataXss), undefined);
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 320, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const bounds = document.getElementById('issue-drawer').getBoundingClientRect();
      return Math.abs(bounds.right - innerWidth) < 1 && bounds.left >= 0;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await reuse.evaluate(element => element.scrollWidth <= element.clientWidth), true);
    if (process.env.SEO_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-metadata-' + name + '.png') });
  }
  await page.locator('#issue-drawer .btn-close').click();
  await page.locator('#issue-drawer').waitFor({ state: 'hidden' });
  await page.locator('#issue-search').fill('duplicate-title');
  const selected = JSON.parse((await download(page, '#export-button')).toString('utf8'));
  assert.equal(selected.issues.length, 1);
  assert.equal(selected.issues[0].details.reuse.distinctObservedH1, 2);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await download(page, '#export-issues-xlsx-button'));
  assert.deepEqual(JSON.parse(workbook.getWorksheet('Issues').getCell('M2').value), selected.issues[0].details);
  await page.locator('#issue-search').fill('');
  await page.locator('#category-filter').selectOption('sharing');
  const sharing = JSON.parse((await download(page, '#export-button')).toString('utf8'));
  assert.equal(sharing.issues.length, 2);
  assert.ok(sharing.issues.every(entry => entry.ruleId === 'open-graph' && entry.steps.length && entry.evidence.length));
  const full = JSON.parse((await download(page, '#export-json-button')).toString('utf8'));
  assert.equal(full.pages.length, 2);
  assert.equal(full.issues.length, 5);
  assert.equal(full.issues.filter(entry => entry.ruleId === 'duplicate-title').length, 1);
  assert.equal(full.issues.filter(entry => entry.ruleId === 'open-graph').length, 2);
  assert.ok(site.requests.every(entry => entry.method === 'GET'));
  await page.reload();
  assert.equal(await page.locator('#detail-content').textContent(), '');
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.deepEqual(errors, []);
});
