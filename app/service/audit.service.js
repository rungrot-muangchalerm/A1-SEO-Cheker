const websiteData = require('../data/website.data');
const auditModel = require('../model/audit.model');
const htmlService = require('./html.service');
const seoService = require('./seo.service');
const robotsService = require('./robots.service');
const discoveryService = require('./discovery.service');
const crawlService = require('./crawl.service');
const crossPageService = require('./cross-page.service');
const internalLinksService = require('./internal-links.service');
const canonicalService = require('./canonical.service');
const sitemapChecksService = require('./sitemap-checks.service');
const renderService = require('./render.service');
const lighthouseService = require('./lighthouse.service');
const siteFilesService = require('./site-files.service');

module.exports = {
  create: async (body, options = {}) => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.url !== 'string') {
      return { ok: false, code: 'INVALID_URL' };
    }
    const startedAt = new Date().toISOString();
    try {
      options = websiteData.auditOptions(body.url, options);
      if (body.crawl === true) {
        const crawl = await crawlService.run(body.url, options);
        options.signal?.throwIfAborted();
        const siteChecks = [...crossPageService.analyze(crawl.pages), ...internalLinksService.analyze(crawl),
          ...canonicalService.analyze(crawl), ...sitemapChecksService.analyze(crawl)];
        if (body.render === true) await renderService.run(crawl.pages, options);
        const lighthouse = body.lighthouse === true ? await lighthouseService.run(crawl.page.requestedUrl, { ...options, strategy: body.strategy }) : undefined;
        options.signal?.throwIfAborted();
        return { ok: true, data: auditModel.createReport(crawl.page, startedAt, crawl.discovery, crawl, siteChecks, lighthouse,
          siteFilesService.analyze(crawl.page, crawl.discovery)) };
      }
      const page = await websiteData.fetchPage(body.url, options);
      options.signal?.throwIfAborted();
      page.metadata = htmlService.parse(page);
      page.robots = await robotsService.load(page.finalUrl, options);
      options.signal?.throwIfAborted();
      page.checks = seoService.analyze(page);
      const discovery = body.discover === true ? await discoveryService.discover(page, options) : undefined;
      options.signal?.throwIfAborted();
      if (body.render === true) await renderService.run([page], options);
      const lighthouse = body.lighthouse === true ? await lighthouseService.run(page.requestedUrl, { ...options, strategy: body.strategy }) : undefined;
      options.signal?.throwIfAborted();
      return { ok: true, data: auditModel.createReport(page, startedAt, discovery, undefined, [], lighthouse,
        siteFilesService.analyze(page, discovery)) };
    } catch (error) {
      return { ok: false, code: error instanceof websiteData.WebsiteError ? error.code : 'INTERNAL_ERROR' };
    }
  }
};
