const http = require('node:http');
const puppeteer = require('puppeteer-core').default;
const { chromium } = require('playwright');
const website = require('../data/website.data');
const robots = require('./robots.service');
const result = require('./lighthouse-result.service');

const limits = Object.freeze({ timeoutMs: 90000, launchTimeoutMs: 10000, maxRequests: 300, maxResourceBytes: 4 * 1024 * 1024,
  maxTotalBytes: 32 * 1024 * 1024, maxRedirects: 5, maxRecords: 100 });
const headersAllowed = ['content-type', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy',
  'cross-origin-resource-policy', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'access-control-allow-origin',
  'access-control-allow-credentials', 'access-control-expose-headers', 'location', 'cache-control', 'expires', 'last-modified', 'etag'];

module.exports = {
  limits,
  run: async (value, options = {}) => {
    const startedAt = new Date().toISOString();
    const format = response => result.format(response, value, { ...options, startedAt, provider: 'lighthouse-local' });
    if (options.strategy !== undefined && !['mobile', 'desktop'].includes(options.strategy)) return format({ status: 'not-checked', reason: 'LIGHTHOUSE_INVALID_STRATEGY' });
    const controller = new AbortController();
    let browser, closing, pendingRun;
    let pending = Promise.resolve();
    const close = () => browser ? (closing ||= browser.close().catch(() => {})) : Promise.resolve();
    const cancel = () => { controller.abort(new website.WebsiteError('CANCELLED')); void close(); };
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { controller.abort(new website.WebsiteError('LIGHTHOUSE_TIMEOUT')); void close(); }, limits.timeoutMs);
    const proxy = http.createServer((_req, res) => { res.writeHead(403, { 'Cache-Control': 'no-store' }); res.end(); });
    proxy.on('connect', (_req, socket) => socket.destroy());
    proxy.on('clientError', (_error, socket) => socket.destroy());
    const records = [];
    let omitted = 0, requests = 0, bytes = 0, budgetBytes = 0;
    const record = entry => {
      if (typeof entry.url === 'string' && entry.url.length > 8192) entry = { ...entry, url: entry.url.slice(0, 8192), urlTruncated: true };
      if (records.length < limits.maxRecords) records.push(entry); else ++omitted;
    };
    const robotsCache = new Map();
    const aborted = operation => new Promise((resolve, reject) => {
      const stop = () => reject(controller.signal.reason);
      if (controller.signal.aborted) return stop();
      controller.signal.addEventListener('abort', stop, { once: true });
      operation.then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', stop));
    });
    try {
      controller.signal.throwIfAborted();
      const selected = website.parseUrl(value, options);
      await website.resolvePublicTarget(selected, controller.signal, options);
      const rules = await robots.load(selected.href, { ...options, signal: controller.signal, robotsCache });
      controller.signal.throwIfAborted();
      if (rules.status === 'not-checked' || rules.crawlerAllowed === undefined) throw new website.WebsiteError('ROBOTS_UNKNOWN');
      if (rules.crawlerAllowed === false) throw new website.WebsiteError('ROBOTS_BLOCKED');
      const { default: lighthouse, desktopConfig } = await import('lighthouse');
      controller.signal.throwIfAborted();
      await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
      browser = await puppeteer.launch({ headless: true, defaultViewport: null, timeout: limits.launchTimeoutMs,
        ...(process.env.LIGHTHOUSE_BROWSER_CHANNEL === 'chrome' || process.env.RENDER_BROWSER_CHANNEL === 'chrome' ?
          { channel: 'chrome' } : { executablePath: chromium.executablePath() }),
        ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-background-networking', '--disable-quic', '--disable-breakpad',
          '--disable-crash-reporter', '--proxy-server=http://127.0.0.1:' + proxy.address().port, '--proxy-bypass-list=<-loopback>',
          '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'] });
      controller.signal.throwIfAborted();
      const page = await browser.newPage();
      await page.setBypassServiceWorker(true);
      await page.evaluateOnNewDocument(() => {
        for (const name of ['WebSocket', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'WebTransport', 'Worker', 'SharedWorker']) {
          Object.defineProperty(globalThis, name, { value: undefined, configurable: false, writable: false });
        }
        if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('Audit policy'));
      });
      page.on('popup', popup => { record({ reason: 'LIGHTHOUSE_POPUP_BLOCKED' }); void popup.close().catch(() => {}); });
      page.on('dialog', dialog => { void dialog.dismiss().catch(() => {}); });
      // Chrome has no direct network path: only vetted GET responses reach the audited page.
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (++requests > limits.maxRequests) {
          controller.abort(new website.WebsiteError('LIGHTHOUSE_REQUEST_LIMIT'));
          void close();
          return;
        }
        const operation = pending.then(async () => {
          controller.signal.throwIfAborted();
          const url = website.parseUrl(request.url(), options);
          const navigation = request.isNavigationRequest();
          if (navigation && url.origin !== selected.origin) throw new website.WebsiteError('OUTSIDE_SCOPE');
          if (request.method() !== 'GET') throw new website.WebsiteError('LIGHTHOUSE_METHOD_BLOCKED');
          if (request.frame() !== page.mainFrame()) throw new website.WebsiteError('LIGHTHOUSE_SUBFRAME_BLOCKED');
          const previous = request.redirectChain();
          if (previous.length > limits.maxRedirects) throw new website.WebsiteError('TOO_MANY_REDIRECTS');
          if (navigation && url.href !== selected.href && !previous.length) throw new website.WebsiteError('LIGHTHOUSE_NAVIGATION_BLOCKED');
          if (options.localOrigin && url.origin === options.localOrigin && previous.some(entry => new URL(entry.url()).origin !== options.localOrigin)) {
            throw new website.WebsiteError('OUTSIDE_SCOPE');
          }
          if (budgetBytes >= limits.maxTotalBytes) throw new website.WebsiteError('LIGHTHOUSE_BYTE_LIMIT');
          const allowance = Math.min(limits.maxResourceBytes, limits.maxTotalBytes - budgetBytes);
          budgetBytes += allowance;
          const localOrigin = url.origin === selected.origin ? options.localOrigin : undefined;
          const response = await website.fetchLighthouseResource(url.href, { signal: controller.signal, localOrigin,
            scopeOrigin: url.origin, maxBytes: allowance, timeoutMs: 10000,
            beforeRequest: async target => {
              const policy = await robots.load(target.href, { signal: controller.signal, localOrigin, robotsCache });
              if (policy.status === 'not-checked' || policy.crawlerAllowed === undefined) throw new website.WebsiteError('ROBOTS_UNKNOWN');
              if (policy.crawlerAllowed === false) throw new website.WebsiteError('ROBOTS_BLOCKED');
            } });
          bytes += response.bytes;
          budgetBytes -= allowance - response.bytes;
          const headers = {};
          for (const name of headersAllowed) if (typeof response.headers[name] === 'string') headers[name] = response.headers[name];
          record({ url: url.href, status: response.status, bytes: response.bytes });
          await request.respond({ status: response.status, headers, body: response.body });
        });
        pending = operation.then(() => {}, async error => {
          record({ url: request.url(), reason: error instanceof website.WebsiteError ? error.code : 'LIGHTHOUSE_RESOURCE_FAILED' });
          await request.abort('blockedbyclient').catch(() => {});
        });
      });
      pendingRun = lighthouse(selected.href, { onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        output: 'json', logLevel: 'silent', enableErrorReporting: false, disableFullPageScreenshot: true,
        maxWaitForLoad: 15000, maxWaitForFcp: 15000 }, options.strategy === 'desktop' ? desktopConfig : undefined, page);
      const outcome = await aborted(pendingRun);
      await pending;
      controller.signal.throwIfAborted();
      const report = format({ status: 'received', data: { lighthouseResult: outcome?.lhr } });
      if (report.categories.length && (records.some(entry => entry.reason || entry.status >= 400) || omitted)) {
        report.status = 'partial'; report.reason = 'LIGHTHOUSE_NETWORK_INCOMPLETE';
      }
      report.network = { requests, bytes, budgetBytes, records, omitted, limits };
      report.limitations = ['single-url', 'protected-GET-only-transport', 'same-origin-local-and-public-resources', 'no-cookies-auth',
        'no-subframes-popups-workers-service-workers-websockets-webrtc', 'local-lab-not-field-data'];
      return report;
    } catch (error) {
      if (options.signal?.aborted) throw new website.WebsiteError('CANCELLED');
      return format({ status: 'not-checked', reason: controller.signal.aborted ? controller.signal.reason.code :
        error instanceof website.WebsiteError ? error.code : browser ? 'LIGHTHOUSE_FAILED' : 'BROWSER_UNAVAILABLE' });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      controller.abort(new website.WebsiteError('CANCELLED'));
      await close();
      await pendingRun?.catch(() => {});
      await pending;
      robotsCache.clear();
      proxy.closeAllConnections();
      if (proxy.listening) await new Promise(resolve => proxy.close(resolve));
    }
  }
};
