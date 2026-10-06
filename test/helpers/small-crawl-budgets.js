module.exports = {
  configure: () => {
    // Exercise safety stops with small server settings, not thousands of fixture requests.
    Object.assign(process.env, {
      CRAWL_MAX_PAGES: '20', CRAWL_MAX_REQUESTS: '60', CRAWL_TIMEOUT_MS: '60000', CRAWL_MAX_HTML_MB: '8',
      DISCOVERY_MAX_URLS: '200', DISCOVERY_MAX_SITEMAPS: '5', DISCOVERY_TIMEOUT_MS: '10000'
    });
  }
};
