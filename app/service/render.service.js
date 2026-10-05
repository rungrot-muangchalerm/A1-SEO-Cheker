const { chromium } = require('playwright');
const cheerio = require('cheerio');
const http = require('node:http');
const { createHash } = require('node:crypto');
const timers = require('node:timers/promises');
const website = require('../data/website.data');
const robots = require('./robots.service');
const html = require('./html.service');

const limits = Object.freeze({ maxPages: 2, timeoutMs: 20000, launchTimeoutMs: 5000, settleMs: 1000,
  maxRequests: 30, minIntervalMs: 250, maxResourceBytes: 512 * 1024, maxTotalBytes: 3 * 1024 * 1024,
  maxDomBytes: 512 * 1024, maxElements: 10000, maxRedirects: 5, maxRecords: 100 });
const allowedTypes = new Set(['Script', 'Stylesheet', 'XHR', 'Fetch']);
const headerNames = ['content-type', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy',
  'cross-origin-resource-policy', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'access-control-allow-origin',
  'access-control-allow-credentials', 'access-control-expose-headers'];

function snapshot(source, url) {
  const $ = cheerio.load(source);
  const body = $('body').clone();
  body.find('script, style, noscript, template').remove();
  const text = body.text().replace(/\s+/g, ' ').trim();
  const metadata = html.parse({ finalUrl: url, html: source, headers: {} });
  return { title: metadata.title, description: metadata.description,
    canonical: metadata.canonical.map((entry) => entry.url || entry.value),
    h1: metadata.headings.filter((entry) => entry.level === 1).map((entry) => entry.value),
    text: { length: text.length, sha256: createHash('sha256').update(text).digest('hex'), preview: text.slice(0, 2000), truncated: text.length > 2000 },
    metadataComplete: !metadata.truncated.length };
}

function needed(source) {
  const $ = cheerio.load(source);
  return $('script').toArray().some((entry) => {
    const type = ($(entry).attr('type') || '').trim().toLowerCase().split(';')[0];
    return !type || type === 'module' || /^(?:text|application)\/(?:java|ecma)script/.test(type);
  }) || $('[onload], [onerror]').length > 0;
}

function responseHeaders(headers, document = false) {
  const result = { 'cache-control': 'no-store' };
  for (const name of headerNames) if (typeof headers[name] === 'string') result[name] = headers[name];
  if (document) result['content-type'] = 'text/html; charset=utf-8';
  if (headers.location) result.location = headers.location;
  return result;
}

module.exports = {
  limits,
  run: async (pages, options = {}) => {
    const controller = new AbortController();
    let browser;
    let closing;
    const closeBrowser = () => browser ? (closing ||= browser.close().catch(() => {})) : Promise.resolve();
    const cancel = () => { controller.abort(new website.WebsiteError('CANCELLED')); void closeBrowser(); };
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, { once: true });
    const deadline = Date.now() + limits.timeoutMs;
    const timer = setTimeout(() => { controller.abort(new website.WebsiteError('RENDER_TIMEOUT')); void closeBrowser(); }, limits.timeoutMs);
    const proxy = http.createServer((_req, res) => { res.writeHead(403, { 'Cache-Control': 'no-store' }); res.end(); });
    proxy.on('connect', (_req, socket) => socket.destroy());
    proxy.on('clientError', (_error, socket) => socket.destroy());
    const stats = { requests: 0, interceptedRequests: 0, bytes: 0, budgetBytes: 0, attemptedPages: 0 };
    const robotsCache = new Map();
    let lastRequest = null;
    const beforeConnect = async (_url, signal, crawlDelay = 0) => {
      if (Date.now() >= deadline) throw new website.WebsiteError('RENDER_TIMEOUT');
      if (stats.requests >= limits.maxRequests) throw new website.WebsiteError('RENDER_REQUEST_LIMIT');
      const interval = Math.max(limits.minIntervalMs, crawlDelay > 0 ? crawlDelay * 1000 : 0);
      while (lastRequest !== null && Date.now() < lastRequest + interval) {
        const wait = lastRequest + interval - Date.now();
        if (Date.now() + wait >= deadline) throw new website.WebsiteError('RENDER_TIMEOUT');
        await timers.setTimeout(wait, undefined, { signal });
      }
      signal.throwIfAborted();
      lastRequest = Date.now();
      ++stats.requests;
    };
    try {
      controller.signal.throwIfAborted();
      await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
      for (const item of pages) {
        options.signal?.throwIfAborted();
        if (!needed(item.html)) { item.render = { status: 'not-checked', reason: 'no-executable-script' }; continue; }
        if (stats.attemptedPages >= limits.maxPages) { item.render = { status: 'not-checked', reason: 'RENDER_PAGE_LIMIT' }; continue; }
        ++stats.attemptedPages;
        const startedAt = new Date().toISOString();
        const records = [];
        let omitted = 0;
        let scriptErrors = 0;
        let consoleErrors = 0;
        let context;
        const requestController = new AbortController();
        const requestSignal = AbortSignal.any([controller.signal, requestController.signal]);
        let pending = Promise.resolve();
        const record = (value) => { if (records.length < limits.maxRecords) records.push(value); else ++omitted; };
        const info = { startedAt, url: item.finalUrl, mode: 'bounded-same-origin-render', limits };
        try {
          controller.signal.throwIfAborted();
          const selected = website.parseUrl(item.finalUrl);
          if (item.status < 200 || item.status >= 300) throw new website.WebsiteError('RENDER_HTTP_STATUS');
          if ((item.headers['content-type'] || 'text/html').split(';')[0].trim().toLowerCase() !== 'text/html') throw new website.WebsiteError('RENDER_DOCUMENT_TYPE');
          const rules = await robots.load(selected.href, { signal: controller.signal, robotsCache, beforeConnect });
          if (rules.status === 'not-checked' || rules.crawlerAllowed === undefined) throw new website.WebsiteError('ROBOTS_UNKNOWN');
          if (rules.crawlerAllowed === false) throw new website.WebsiteError('ROBOTS_BLOCKED');
          if (!browser) browser = await chromium.launch({ headless: true, chromiumSandbox: true, timeout: limits.launchTimeoutMs,
            ...(process.env.RENDER_BROWSER_CHANNEL ? { channel: process.env.RENDER_BROWSER_CHANNEL } : {}),
            proxy: { server: 'http://127.0.0.1:' + proxy.address().port, bypass: '<-loopback>' },
            args: ['--disable-background-networking', '--disable-quic', '--disable-breakpad', '--disable-crash-reporter',
              '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--js-flags=--max-old-space-size=128',
              '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
          controller.signal.throwIfAborted();
          context = await browser.newContext({ offline: true, serviceWorkers: 'block', acceptDownloads: false,
            permissions: [], viewport: { width: 1280, height: 800 }, userAgent: 'SEOChecker/0.1' });
          await context.addInitScript(() => {
            for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'WebTransport', 'Worker', 'SharedWorker']) {
              Object.defineProperty(globalThis, name, { value: undefined, configurable: false, writable: false });
            }
          });
          await context.routeWebSocket('**/*', (socket) => { record({ url: socket.url(), reason: 'WEBSOCKET_BLOCKED' }); socket.close({ code: 1008, reason: 'Renderer policy' }); });
          const page = await context.newPage();
          context.on('page', (popup) => { if (popup !== page) { record({ reason: 'POPUP_BLOCKED' }); void popup.close().catch(() => {}); } });
          page.on('pageerror', () => ++scriptErrors);
          page.on('console', (message) => { if (message.type() === 'error') ++consoleErrors; });
          page.on('requestfailed', (request) => record({ url: request.url(), reason: 'RENDER_BROWSER_REQUEST_FAILED' }));
          page.on('dialog', (dialog) => { void dialog.dismiss().catch(() => {}); });
          let mainUsed = false;
          const cdp = await context.newCDPSession(page);
          const { frameTree } = await cdp.send('Page.getFrameTree');
          const redirectCounts = new Map();
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
          await cdp.send('Network.setBypassServiceWorker', { bypass: true });
          // CDP pauses every redirect hop, not only the first URL of a routed request.
          cdp.on('Fetch.requestPaused', (event) => {
            const request = event.request;
            if (++stats.interceptedRequests > limits.maxRecords) {
              controller.abort(new website.WebsiteError('RENDER_REQUEST_LIMIT'));
              void closeBrowser();
              return;
            }
            const fulfill = (status, headers, body) => cdp.send('Fetch.fulfillRequest', { requestId: event.requestId,
              responseCode: status, responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })), body: Buffer.from(body).toString('base64') });
            const operation = pending.then(async () => {
              requestSignal.throwIfAborted();
              const url = website.parseUrl(request.url);
              if (url.origin !== selected.origin) throw new website.WebsiteError('OUTSIDE_SCOPE');
              if (request.method !== 'GET') throw new website.WebsiteError('RENDER_METHOD_BLOCKED');
              if (event.resourceType === 'Document') {
                if (mainUsed || event.frameId !== frameTree.frame.id || url.href !== selected.href) throw new website.WebsiteError('RENDER_NAVIGATION_BLOCKED');
                mainUsed = true;
                await fulfill(item.status, responseHeaders(item.headers, true), item.html);
                return;
              }
              if (!allowedTypes.has(event.resourceType)) throw new website.WebsiteError('RENDER_RESOURCE_BLOCKED');
              const redirectCount = event.redirectedRequestId ? (redirectCounts.get(event.redirectedRequestId) || 0) + 1 : 0;
              redirectCounts.set(event.requestId, redirectCount);
              if (redirectCount > limits.maxRedirects) throw new website.WebsiteError('TOO_MANY_REDIRECTS');
              const remainingBytes = limits.maxTotalBytes - stats.budgetBytes;
              if (remainingBytes <= 0) throw new website.WebsiteError('RENDER_BYTE_LIMIT');
              const allowance = Math.min(limits.maxResourceBytes, remainingBytes);
              stats.budgetBytes += allowance;
              const result = await website.fetchRenderResource(url.href, { signal: requestSignal, scopeOrigin: selected.origin,
                timeoutMs: Math.max(1, Math.min(5000, deadline - Date.now())), maxBytes: allowance,
                beforeRequest: async (target, signal) => {
                  const policy = await robots.load(target.href, { signal, robotsCache, beforeConnect });
                  if (policy.status === 'not-checked' || policy.crawlerAllowed === undefined) throw new website.WebsiteError('ROBOTS_UNKNOWN');
                  if (policy.crawlerAllowed === false) throw new website.WebsiteError('ROBOTS_BLOCKED');
                }, beforeConnect: (target, signal) => beforeConnect(target, signal, rules.crawlDelay) });
              stats.bytes += result.bytes;
              stats.budgetBytes -= allowance - result.bytes;
              record({ url: url.href, status: result.status, bytes: result.bytes, ...(result.redirect ? { destination: result.redirect } : {}) });
              await fulfill(result.status, responseHeaders(result.headers), result.body);
            });
            pending = operation.then(() => {}, async (error) => {
              record({ url: request.url, reason: error instanceof website.WebsiteError ? error.code : 'RENDER_RESOURCE_FAILED',
                ...(error.observation ? { status: error.observation.status } : {}) });
              await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
            });
          });
          await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
          await page.goto(selected.href, { waitUntil: 'domcontentloaded', timeout: Math.max(1, deadline - Date.now()) });
          await timers.setTimeout(limits.settleMs, undefined, { signal: controller.signal });
          await pending;
          const dom = await page.evaluate(({ maxElements, maxDomBytes }) => {
            if (document.getElementsByTagName('*').length > maxElements) return { reason: 'RENDER_ELEMENT_LIMIT' };
            const source = document.documentElement.outerHTML;
            if (new TextEncoder().encode(source).length > maxDomBytes) return { reason: 'RENDER_DOM_LIMIT' };
            return { html: source, url: document.URL };
          }, limits);
          controller.signal.throwIfAborted();
          if (dom.reason) throw new website.WebsiteError(dom.reason);
          if (new URL(dom.url).origin !== selected.origin) throw new website.WebsiteError('RENDER_NAVIGATION_BLOCKED');
          const before = snapshot(item.html, selected.href);
          const after = snapshot(dom.html, dom.url);
          const changes = ['title', 'description', 'canonical', 'h1'].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
          if (before.text.sha256 !== after.text.sha256) changes.push('body-text');
          const complete = !records.some((entry) => entry.reason || entry.status >= 400) && !omitted && !scriptErrors && !consoleErrors && before.metadataComplete && after.metadataComplete;
          item.render = { ...info, status: complete ? 'completed' : 'partial', complete, completedAt: new Date().toISOString(),
            engine: { name: 'Chromium', version: browser.version(), playwright: require('playwright/package.json').version },
            before, after: { ...after, html: dom.html, documentUrl: dom.url, sourceFormat: 'rendered-dom' }, changes,
            resources: { records, omitted, scriptErrors, consoleErrors }, limitations: ['same-origin-assets-only', 'GET-only', 'no-images-fonts-media',
              'no-subframes-popups-workers-service-workers-websockets-webrtc', 'no-interactions', 'bounded-observation-window'] };
        } catch (error) {
          if (options.signal?.aborted) throw new website.WebsiteError('CANCELLED');
          item.render = { ...info, status: 'not-checked', reason: controller.signal.aborted ? controller.signal.reason.code :
            error instanceof website.WebsiteError ? error.code : !browser ? 'BROWSER_UNAVAILABLE' : 'RENDER_FAILED',
            completedAt: new Date().toISOString(), resources: { records, omitted, scriptErrors, consoleErrors } };
        } finally {
          requestController.abort(new website.WebsiteError('RENDER_OBSERVATION_ENDED'));
          if (context) await context.close().catch(() => {});
          await pending;
          if (item.render) {
            item.render.resources = { records: [...records], omitted, scriptErrors, consoleErrors };
            if (item.render.after && (records.some((entry) => entry.reason || entry.status >= 400) || omitted || scriptErrors || consoleErrors)) {
              item.render.status = 'partial';
              item.render.complete = false;
            }
          }
        }
      }
      for (const item of pages) if (item.render) {
        item.render.indexing = { status: 'not-checked', reason: 'not-search-engine-observation' };
        if (item.render.mode) item.render.stats = { ...stats };
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      controller.abort(new website.WebsiteError('CANCELLED'));
      await closeBrowser();
      proxy.closeAllConnections();
      if (proxy.listening) await new Promise((resolve) => proxy.close(resolve));
      robotsCache.clear();
    }
  }
};
