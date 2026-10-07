const robotsParser = require('robots-parser');
const cheerio = require('cheerio');
const website = require('../data/website.data');

module.exports = {
  load: async (pageUrl, options = {}) => {
    const url = new URL('/robots.txt', pageUrl).href;
    let response;
    try {
      let operation = options.robotsCache?.get(url);
      if (!operation) {
        operation = website.fetchRobots(url, {
          signal: options.signal, scopeOrigin: new URL(pageUrl).origin,
          localOrigin: options.localOrigin,
          beforeRequest: options.beforeRequest, beforeConnect: options.beforeConnect, onConnect: options.onConnect
        });
        options.robotsCache?.set(url, operation);
      }
      response = await operation;
    }
    catch (error) {
      if (options.signal?.aborted) throw error;
      return { url, status: 'not-checked', reason: error instanceof website.WebsiteError ? error.code : 'ROBOTS_FAILED' };
    }
    options.signal?.throwIfAborted();
    const evidence = {
      kind: 'robots', url, finalUrl: response.finalUrl, httpStatus: response.status,
      redirects: response.redirects, bytes: response.bytes, contentType: response.headers?.['content-type'] || null
    };
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      return { ...evidence, status: 'absent', googlebotAllowed: true, crawlerAllowed: true, sitemaps: [] };
    }
    if (response.status < 200 || response.status >= 300) {
      return { ...evidence, status: 'not-checked', reason: 'ROBOTS_UNAVAILABLE' };
    }
    evidence.bodyFormat = response.text.trimStart().startsWith('<') &&
      cheerio.load(response.text, { sourceCodeLocationInfo: true })('*').toArray().some(entry => entry.sourceCodeLocation) ? 'html' : 'text';
    const lines = response.text.split(/\r\n|\r|\n/);
    const target = new URL(pageUrl);
    const pathLength = target.pathname.length + target.search.length;
    const wildcardCost = lines.filter((line) => /^(?:allow|disallow)\s*:/i.test(line.trim()) && line.includes('*'))
      .reduce((sum, line) => sum + line.length * pathLength, 0);
    if (lines.length > 2000 || lines.some((line) => line.length > 2048) || wildcardCost > 10000000) {
      return { ...evidence, status: 'not-checked', reason: 'ROBOTS_TOO_COMPLEX' };
    }
    const parser = robotsParser(url, response.text);
    const describe = (agent) => {
      const line = parser.getMatchingLineNumber(pageUrl, agent);
      return {
        agent, allowed: parser.isAllowed(pageUrl, agent),
        line: line > 0 ? line : null, source: line > 0 ? lines[line - 1] : null
      };
    };
    const googlebot = describe('Googlebot');
    const crawler = describe('SEOChecker');
    return {
      ...evidence, status: 'checked', googlebotAllowed: googlebot.allowed,
      crawlerAllowed: crawler.allowed, rules: [googlebot, crawler],
      crawlDelay: parser.getCrawlDelay('SEOChecker') ?? null, sitemaps: parser.getSitemaps()
    };
  }
};
