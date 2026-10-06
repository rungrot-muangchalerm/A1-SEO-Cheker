const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

function load(settings = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(CRAWL_|DISCOVERY_)/.test(key)) delete env[key];
  return spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(require("./app/config/crawl.config")))'], {
    cwd: require('node:path').resolve(__dirname, '../..'), env: { ...env, ...settings }, encoding: 'utf8', windowsHide: true
  });
}

test('default crawl budgets support entire small sites and remain finite with unchanged request pacing', () => {
  const result = load();
  assert.equal(result.status, 0);
  const config = JSON.parse(result.stdout);
  assert.deepEqual(config.crawl, { maxPages: 5000, maxConcurrency: 1, minIntervalMs: 500,
    timeoutMs: 3600000, maxRequests: 40000, maxHtmlBytes: 128 * 1024 * 1024 });
  assert.equal(config.discovery.maxUrls, 10000);
  assert.equal(config.discovery.maxSitemaps, 100);
  assert.equal(config.discovery.timeoutMs, 300000);
});

test('server environment configures budgets without giving browsers access to pacing or unlimited resources', () => {
  const result = load({ CRAWL_MAX_PAGES: '300', CRAWL_TIMEOUT_MS: '120000', CRAWL_MAX_REQUESTS: '1000', CRAWL_MAX_HTML_MB: '16',
    DISCOVERY_MAX_URLS: '700', DISCOVERY_MAX_SITEMAPS: '20', DISCOVERY_TIMEOUT_MS: '30000' });
  assert.equal(result.status, 0);
  const config = JSON.parse(result.stdout);
  assert.equal(config.crawl.maxPages, 300);
  assert.equal(config.crawl.timeoutMs, 120000);
  assert.equal(config.crawl.maxRequests, 1000);
  assert.equal(config.crawl.maxHtmlBytes, 16 * 1024 * 1024);
  assert.equal(config.crawl.minIntervalMs, 500);
  assert.equal(config.discovery.maxUrls, 700);
  assert.equal(config.discovery.maxSitemaps, 20);
  assert.equal(config.discovery.timeoutMs, 30000);
});

test('malformed, negative, fractional, infinite and excessive server budgets fail explicitly', () => {
  for (const settings of [{ CRAWL_MAX_PAGES: 'no' }, { CRAWL_MAX_PAGES: '-1' }, { CRAWL_MAX_PAGES: '3.5' },
    { CRAWL_MAX_PAGES: 'Infinity' }, { CRAWL_MAX_PAGES: '10001' }, { CRAWL_MAX_REQUESTS: '0' },
    { CRAWL_TIMEOUT_MS: '86400001' }, { CRAWL_MAX_HTML_MB: '257' }, { DISCOVERY_MAX_URLS: '10001' },
    { DISCOVERY_MAX_SITEMAPS: '1001' }, { DISCOVERY_TIMEOUT_MS: '3600001' }]) {
    const result = load(settings);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes('Invalid crawl setting: ' + Object.keys(settings)[0]));
  }
});
