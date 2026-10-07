const website = require('../data/website.data');
const sitemapService = require('./sitemap.service');

const limits = require('../config/crawl.config').discovery;
const urlIndexes = new WeakMap();

function skip(collection, entry) {
  if (collection.skipped.length < limits.maxSkipped) collection.skipped.push(entry);
  else collection.skippedOmitted++;
}

function add(collection, value, evidence) {
  let url;
  try { url = website.parseUrl(value, { localOrigin: collection.localOrigin }); } catch { skip(collection, { value, reason: 'invalid-url', ...evidence }); return; }
  if (url.origin !== collection.origin) { skip(collection, { url: url.href, reason: 'outside-origin', ...evidence }); return; }
  let index = urlIndexes.get(collection);
  if (!index) {
    index = new Map(collection.urls.map((entry) => [entry.url, entry]));
    urlIndexes.set(collection, index);
  }
  const existing = index.get(url.href);
  if (existing) { if (existing.sources.length < 5) existing.sources.push(evidence); return; }
  if (collection.urls.length >= limits.maxUrls) {
    collection.limitReached = true; skip(collection, { url: url.href, reason: 'url-limit', ...evidence }); return;
  }
  const entry = { url: url.href, sources: [evidence] };
  collection.urls.push(entry);
  index.set(url.href, entry);
}

function extend(collection, page, includePage = true, includeCanonical = false) {
  if (includePage) add(collection, page.finalUrl, { kind: 'fetched-page', sourceUrl: page.requestedUrl || page.finalUrl });
  collection.linkExtractionComplete &&= !page.metadata.truncated.includes('links');
  for (const link of page.metadata.links) {
    if (!link.url) continue;
    add(collection, link.url, { kind: 'html-link', sourceUrl: page.finalUrl, selector: link.selector, location: link.location,
      source: link.source, sourceTruncated: link.sourceTruncated });
  }
  if (includeCanonical) {
    for (const entry of page.metadata.canonical) {
      if (!entry.url || Object.keys(entry.parameters || {}).length) continue;
      add(collection, entry.url, { ...entry, kind: entry.kind === 'header' ? 'header-canonical' : 'html-canonical', sourceUrl: page.finalUrl });
    }
  }
}

module.exports = {
  limits, extend,
  discover: async (page, options = {}) => {
    const origin = new URL(page.finalUrl).origin;
    const skipped = [];
    const collection = { origin, urls: [], skipped, skippedOmitted: 0, limitReached: false, linkExtractionComplete: true, limits,
      ...(options.localOrigin ? { localOrigin: options.localOrigin } : {}) };
    add(collection, page.finalUrl, { kind: 'requested-page', sourceUrl: page.finalUrl });
    extend(collection, page, false, options.includeCanonical === true);
    const queue = [];
    const queued = new Set();
    const enqueue = (value, evidence = {}) => {
      let url;
      try { url = website.parseUrl(value, options); } catch { skip(collection, { value, kind: 'sitemap', reason: 'invalid-url', ...evidence }); return; }
      if (url.origin !== origin) { skip(collection, { url: url.href, kind: 'sitemap', reason: 'outside-origin', ...evidence }); return; }
      if (queued.has(url.href)) return;
      if (queue.length >= limits.maxSitemapCandidates) {
        collection.limitReached = true; skip(collection, { url: url.href, kind: 'sitemap', reason: 'sitemap-queue-limit', ...evidence }); return;
      }
      queued.add(url.href);
      queue.push({ value: url.href, ...evidence });
    };
    for (const value of [...(page.robots?.sitemaps || []), new URL('/sitemap.xml', origin).href]) enqueue(value);
    const started = Date.now();
    const seen = new Set();
    const sitemaps = [];
    for (let index = 0; index < queue.length; index++) {
      const { value, sourceUrl, entryIndex } = queue[index];
      options.signal?.throwIfAborted();
      let url;
      try { url = website.parseUrl(value, options); } catch { skip(collection, { value, kind: 'sitemap', reason: 'invalid-url' }); continue; }
      if (url.origin !== origin) { skip(collection, { url: url.href, kind: 'sitemap', reason: 'outside-origin' }); continue; }
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      if (sitemaps.length >= limits.maxSitemaps) { collection.limitReached = true; skip(collection, { url: url.href, kind: 'sitemap', reason: 'sitemap-limit' }); continue; }
      const remainingMs = limits.timeoutMs - (Date.now() - started);
      if (remainingMs <= 0) { collection.limitReached = true; skip(collection, { url: url.href, kind: 'sitemap', reason: 'sitemap-deadline' }); continue; }
      let evidence;
      try {
        const response = await website.fetchSitemap(url.href, { signal: options.signal, timeoutMs: Math.min(5000, remainingMs), scopeOrigin: origin,
          localOrigin: options.localOrigin,
          beforeRequest: options.beforeRequest, beforeConnect: options.beforeConnect, onConnect: options.onConnect });
        options.signal?.throwIfAborted();
        seen.add(response.finalUrl);
        evidence = { url: url.href, finalUrl: response.finalUrl, httpStatus: response.status, bytes: response.bytes, redirects: response.redirects,
          contentType: response.headers?.['content-type'] || null,
          ...(sourceUrl ? { sourceUrl, entryIndex } : {}) };
        if (response.status < 200 || response.status >= 300) {
          sitemaps.push({ ...evidence, status: 'not-checked', reason: 'sitemap-http-status' });
          continue;
        }
        const parsed = sitemapService.parse(response.text, options);
        sitemaps.push({ ...evidence, ...parsed, status: 'checked' });
        if (parsed.truncated) collection.limitReached = true;
        for (const entry of parsed.entries) {
          if (!entry.url) { skip(collection, { ...entry, sourceUrl: response.finalUrl, reason: 'invalid-sitemap-url' }); continue; }
          if (parsed.type === 'urlset') add(collection, entry.url, { ...entry, sourceUrl: response.finalUrl });
          else enqueue(entry.url, { sourceUrl: response.finalUrl, entryIndex: entry.entryIndex });
        }
      } catch (error) {
        if (options.signal?.aborted) throw error;
        const observed = error.observation;
        sitemaps.push({ ...(evidence || (observed ? { finalUrl: observed.url, httpStatus: observed.status,
          contentType: observed.headers?.['content-type'] || null } : {})),
          url: url.href, status: 'not-checked', reason: error instanceof website.WebsiteError ? error.code : 'SITEMAP_FAILED' });
      } finally {
        await options.onDiscovery?.({ ...collection, sitemaps });
      }
    }
    return { ...collection, sitemaps };
  }
};
