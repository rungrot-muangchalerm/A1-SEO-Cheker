const timers = require('node:timers/promises');
const website = require('../data/website.data');
const robots = require('./robots.service');
const html = require('./html.service');
const seo = require('./seo.service');
const discoveryService = require('./discovery.service');

const limits = Object.freeze({ maxPages: 20, maxConcurrency: 1, minIntervalMs: 500,
  timeoutMs: 60000, maxRequests: 60, maxHtmlBytes: 8 * 1024 * 1024 });
const stopCodes = new Set(['CRAWL_DEADLINE', 'CRAWL_REQUEST_LIMIT', 'CRAWL_BYTE_LIMIT']);

module.exports = {
  limits,
  run: async (value, options = {}) => {
    const requested = website.parseUrl(value);
    const controller = new AbortController();
    const cancel = () => controller.abort(new website.WebsiteError('CANCELLED'));
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new website.WebsiteError('CRAWL_DEADLINE')), limits.timeoutMs);
    const deadline = Date.now() + limits.timeoutMs;
    const robotsCache = new Map();
    const seen = new Set();
    const pages = [];
    const skipped = [];
    const stats = { requests: 0, attemptedPages: 0, htmlBytes: 0 };
    let lastRequest = null;
    let stopReason = null;
    let discovery;
    const notify = async (phase, currentUrl = null) => {
      await options.onProgress?.({ phase, currentUrl, origin: discovery?.origin || new URL(pages[0]?.finalUrl || requested.href).origin,
        discovered: discovery?.urls.length || (pages.length ? 1 : 0), fetched: pages.length, analyzed: pages.length,
        skipped: skipped.length, skippedEntries: [...skipped], limitReached: !!(stopReason || discovery?.limitReached), stopReason,
        limits, attemptedPages: stats.attemptedPages });
    };
    const throttle = async (_url, signal, crawlDelay = 0) => {
      if (stats.requests >= limits.maxRequests) throw new website.WebsiteError('CRAWL_REQUEST_LIMIT');
      const interval = Math.max(limits.minIntervalMs, Number.isFinite(crawlDelay) && crawlDelay > 0 ? crawlDelay * 1000 : 0);
      const wait = lastRequest === null ? 0 : Math.max(0, lastRequest + interval - Date.now());
      if (Date.now() + wait >= deadline) throw new website.WebsiteError('CRAWL_DEADLINE');
      if (wait) await timers.setTimeout(wait, undefined, { signal });
      signal.throwIfAborted();
      lastRequest = Date.now();
      stats.requests++;
    };
    const policyOptions = { signal: controller.signal, robotsCache, beforeRequest: throttle };
    const beforeRequest = async (url, signal) => {
      if (seen.has(url.href)) throw new website.WebsiteError('ALREADY_FETCHED');
      const rules = await robots.load(url.href, policyOptions);
      signal.throwIfAborted();
      if (rules.status === 'not-checked' || rules.crawlerAllowed === undefined) {
        throw new website.WebsiteError(rules.reason === 'PRIVATE_TARGET' ? 'PRIVATE_TARGET' : 'ROBOTS_UNKNOWN');
      }
      if (rules.crawlerAllowed === false) throw new website.WebsiteError('ROBOTS_BLOCKED');
      await throttle(url, signal, rules.crawlDelay);
    };
    const networkOptions = { signal: controller.signal, beforeRequest,
      onDiscovery: async (collection) => { discovery = collection; await notify('discovering'); } };
    const analyze = async (page) => {
      page.metadata = html.parse(page);
      page.robots = await robots.load(page.finalUrl, policyOptions);
      controller.signal.throwIfAborted();
      page.checks = seo.analyze(page);
      pages.push(page);
      seen.add(page.requestedUrl);
      seen.add(page.finalUrl);
      for (const redirect of page.redirects) seen.add(redirect.url);
      stats.htmlBytes += page.bytes;
    };
    try {
      stats.attemptedPages++;
      const root = await website.fetchPage(requested.href, networkOptions);
      await analyze(root);
      await notify('discovering');
      try { discovery = await discoveryService.discover(root, networkOptions); }
      catch (error) {
        if (options.signal?.aborted || !stopCodes.has(error.code)) throw error;
        stopReason = error.code;
        discovery = { origin: new URL(root.finalUrl).origin, urls: [], sitemaps: [], skipped: [], skippedOmitted: 0,
          limitReached: true, linkExtractionComplete: false, limits: discoveryService.limits };
        discoveryService.extend(discovery, root);
      }
      // The array grows as fetched documents contribute links; URL identity and all budgets stay bounded.
      for (const entry of discovery.urls) {
        if (options.signal?.aborted) throw new website.WebsiteError('CANCELLED');
        if (seen.has(entry.url)) continue;
        if (!stopReason && stats.attemptedPages >= limits.maxPages) stopReason = 'CRAWL_PAGE_LIMIT';
        if (!stopReason && stats.htmlBytes >= limits.maxHtmlBytes) stopReason = 'CRAWL_BYTE_LIMIT';
        if (!stopReason && controller.signal.aborted) stopReason = controller.signal.reason.code;
        if (stopReason) { skipped.push({ url: entry.url, reason: stopReason }); await notify('page-skipped', entry.url); continue; }
        stats.attemptedPages++;
        await notify('crawling', entry.url);
        const remainingBytes = limits.maxHtmlBytes - stats.htmlBytes;
        try {
          const page = await website.fetchPage(entry.url, { ...networkOptions, scopeOrigin: discovery.origin,
            maxBytes: Math.min(website.limits.maxBytes, remainingBytes) });
          await analyze(page);
          discoveryService.extend(discovery, page);
        } catch (error) {
          if (options.signal?.aborted) throw new website.WebsiteError('CANCELLED');
          let reason = error instanceof website.WebsiteError ? error.code : controller.signal.aborted ? controller.signal.reason.code : 'CRAWL_FAILED';
          if (reason === 'RESPONSE_TOO_LARGE' && remainingBytes < website.limits.maxBytes) reason = 'CRAWL_BYTE_LIMIT';
          if (stopCodes.has(reason)) stopReason = reason;
          skipped.push({ url: entry.url, reason });
        } finally { seen.add(entry.url); }
        await notify('crawling', entry.url);
      }
      await notify('completed');
      return { page: root, pages, discovery, skipped, limits, stats, stopReason, limitReached: !!stopReason };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      robotsCache.clear();
    }
  }
};
