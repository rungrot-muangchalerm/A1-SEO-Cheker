function integer(name, fallback, min, max) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error('Invalid crawl setting: ' + name);
  }
  return parsed;
}

const crawl = Object.freeze({
  maxPages: integer('CRAWL_MAX_PAGES', 5000, 1, 10000),
  maxConcurrency: 1,
  minIntervalMs: 500,
  timeoutMs: integer('CRAWL_TIMEOUT_MS', 3600000, 1000, 86400000),
  maxRequests: integer('CRAWL_MAX_REQUESTS', 40000, 1, 100000),
  maxHtmlBytes: integer('CRAWL_MAX_HTML_MB', 128, 2, 256) * 1024 * 1024
});

const maxUrls = integer('DISCOVERY_MAX_URLS', 10000, 1, 10000);
const discovery = Object.freeze({
  maxUrls,
  maxSitemaps: integer('DISCOVERY_MAX_SITEMAPS', 100, 1, 1000),
  maxSitemapCandidates: Math.min(1000, maxUrls),
  maxSkipped: maxUrls,
  timeoutMs: integer('DISCOVERY_TIMEOUT_MS', 300000, 1000, 3600000)
});

module.exports = { crawl, discovery };
