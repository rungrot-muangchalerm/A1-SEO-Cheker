const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const layouts = require('express-ejs-layouts');
const { chromium } = require('@playwright/test');
const htmlService = require('../../../app/service/html.service');
const seoService = require('../../../app/service/seo.service');
const model = require('../../../app/model/audit.model');

const root = path.resolve(__dirname, '../../..');
const auditOptions = new WeakMap();
const good = fs.readFileSync(path.join(__dirname, '../fixtures/seo-good.html'), 'utf8');
const bad = fs.readFileSync(path.join(__dirname, '../fixtures/seo-bad.html'), 'utf8');

function report(url, source = good, options = {}) {
  const page = {
    requestedUrl: url, finalUrl: url, html: source, status: 200, headers: {}, rawHeaders: [],
    bytes: Buffer.byteLength(source), redirects: [],
    robots: { kind: 'robots', url: new URL('/robots.txt', url).href, status: 'absent', httpStatus: 404, googlebotAllowed: true },
    ...options
  };
  page.metadata = htmlService.parse(page);
  page.checks = seoService.analyze(page);
  return model.createReport(page, new Date().toISOString());
}

async function frontend(t, viewport = { width: 1280, height: 900 }, options = {}) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));
  app.set('layout', false);
  app.use(layouts);
  app.use(require('../../../app/middleware/local.middleware').only);
  app.use(express.json());
  app.use(require('../../../app/middleware/audit-admission.middleware').create());
  app.use('/assets', express.static(path.join(root, 'assets')));
  app.use(require('../../../app/routes/router'));
  app.use(require('../../../app/middleware/audit.middleware').error);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const assets = [
    ['bootstrap@5.3.8/dist/css/bootstrap.min.css', 'bootstrap/dist/css/bootstrap.min.css', 'text/css'],
    ['bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js', 'bootstrap/dist/js/bootstrap.bundle.min.js', 'application/javascript'],
    ['lucide@1.51.0/dist/umd/lucide.min.js', 'lucide/dist/umd/lucide.min.js', 'application/javascript'],
    ['exceljs@4.4.0/dist/exceljs.min.js', 'exceljs/dist/exceljs.min.js', 'application/javascript']
  ];
  // Offline CDN fixtures use the exact npm versions; application URLs remain CDN URLs.
  await page.route('https://cdn.jsdelivr.net/**', (route) => {
    const asset = assets.find(([suffix]) => route.request().url().endsWith(suffix));
    if (!asset) return route.abort();
    return route.fulfill({
      body: fs.readFileSync(path.join(root, 'node_modules', asset[1])), contentType: asset[2],
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  // Focused fixtures use explicit API scopes; fullAudit exercises the untouched browser request.
  if (!options.fullAudit) {
    auditOptions.set(page, { discover: false, crawl: false, render: false, lighthouse: false });
    await page.route(origin + '/api/audits', route => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), ...auditOptions.get(page) }) });
    });
  }
  await page.goto(origin);
  await page.waitForFunction(() => window.bootstrap && document.querySelector('header svg'));
  return { page, browser, context, origin, errors };
}

async function scan(page, url, options = {}) {
  if (auditOptions.has(page)) setAuditOptions(page, { ...options, lighthouse: options.lighthouse === true });
  await page.locator('#website-url').fill(url);
  await page.locator('#scan-button').click();
  await page.waitForFunction(() => document.getElementById('report').getAttribute('aria-busy') === 'false');
}

function setAuditOptions(page, options) {
  if (!auditOptions.has(page)) throw new Error('Full audit requests must not be overridden by fixture options');
  auditOptions.set(page, { ...auditOptions.get(page), ...options });
}

async function clickExport(page, selector) {
  if (!await page.locator('#export-menu').isVisible()) await page.locator('#export-menu-button').click();
  await page.locator(selector).click();
}

module.exports = { frontend, scan, report, good, bad, setAuditOptions, clickExport };
