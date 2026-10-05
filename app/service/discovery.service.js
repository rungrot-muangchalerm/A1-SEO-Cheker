const website = require('../data/website.data');
const sitemapService = require('./sitemap.service');

const limits = Object.freeze({ maxUrls: 200, maxSitemaps: 5, maxSkipped: 200, timeoutMs: 10000 });

module.exports = {
  limits,
  discover: async (page, options = {}) => {
    const origin = new URL(page.finalUrl).origin;
    const urls = new Map();
    const skipped = [];
    let skippedOmitted = 0;
    let limitReached = false;
    const skip = (entry) => {
      if (skipped.length < limits.maxSkipped) skipped.push(entry);
      else skippedOmitted++;
    };
    const add = (value, evidence) => {
      let url;
      try { url = website.parseUrl(value); } catch { skip({ value, reason: 'invalid-url', ...evidence }); return; }
      if (url.origin !== origin) { skip({ url: url.href, reason: 'outside-origin', ...evidence }); return; }
      const existing = urls.get(url.href);
      if (existing) { if (existing.sources.length < 5) existing.sources.push(evidence); return; }
      if (urls.size >= limits.maxUrls) { limitReached = true; skip({ url: url.href, reason: 'url-limit', ...evidence }); return; }
      urls.set(url.href, { url: url.href, sources: [evidence] });
    };
    add(page.finalUrl, { kind: 'requested-page', sourceUrl: page.finalUrl });
    for (const link of page.metadata.links) {
      if (!link.url) continue;
      add(link.url, { kind: 'html-link', sourceUrl: page.finalUrl, selector: link.selector, location: link.location,
        source: link.source, sourceTruncated: link.sourceTruncated });
    }
    const queue = [...(page.robots?.sitemaps || []), new URL('/sitemap.xml', origin).href].map((value) => ({ value }));
    const started = Date.now();
    const seen = new Set();
    const sitemaps = [];
    for (let index = 0; index < queue.length; index++) {
      const { value, sourceUrl, entryIndex } = queue[index];
      options.signal?.throwIfAborted();
      let url;
      try { url = website.parseUrl(value); } catch { skip({ value, kind: 'sitemap', reason: 'invalid-url' }); continue; }
      if (url.origin !== origin) { skip({ url: url.href, kind: 'sitemap', reason: 'outside-origin' }); continue; }
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      if (sitemaps.length >= limits.maxSitemaps) { limitReached = true; skip({ url: url.href, kind: 'sitemap', reason: 'sitemap-limit' }); continue; }
      const remainingMs = limits.timeoutMs - (Date.now() - started);
      if (remainingMs <= 0) { limitReached = true; skip({ url: url.href, kind: 'sitemap', reason: 'sitemap-deadline' }); continue; }
      try {
        const response = await website.fetchSitemap(url.href, { signal: options.signal, timeoutMs: Math.min(5000, remainingMs) });
        options.signal?.throwIfAborted();
        seen.add(response.finalUrl);
        const evidence = { url: url.href, finalUrl: response.finalUrl, httpStatus: response.status, bytes: response.bytes, redirects: response.redirects,
          ...(sourceUrl ? { sourceUrl, entryIndex } : {}) };
        if (response.status < 200 || response.status >= 300) {
          sitemaps.push({ ...evidence, status: 'not-checked', reason: 'sitemap-http-status' });
          continue;
        }
        const parsed = sitemapService.parse(response.text);
        sitemaps.push({ ...evidence, ...parsed, status: 'checked' });
        if (parsed.truncated) limitReached = true;
        for (const entry of parsed.entries) {
          if (!entry.url) { skip({ ...entry, sourceUrl: response.finalUrl, reason: 'invalid-sitemap-url' }); continue; }
          if (parsed.type === 'urlset') add(entry.url, { ...entry, sourceUrl: response.finalUrl });
          else queue.push({ value: entry.url, sourceUrl: response.finalUrl, entryIndex: entry.entryIndex });
        }
      } catch (error) {
        if (options.signal?.aborted) throw error;
        sitemaps.push({ url: url.href, status: 'not-checked', reason: error instanceof website.WebsiteError ? error.code : 'SITEMAP_FAILED' });
      }
    }
    return { origin, urls: [...urls.values()], sitemaps, skipped, skippedOmitted, limitReached,
      linkExtractionComplete: !page.metadata.truncated.includes('links'), limits };
  }
};
