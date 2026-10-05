const websiteData = require('../data/website.data');
const auditModel = require('../model/audit.model');
const htmlService = require('./html.service');
const seoService = require('./seo.service');
const robotsService = require('./robots.service');

module.exports = {
  create: async (body, options = {}) => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.url !== 'string') {
      return { ok: false, code: 'INVALID_URL' };
    }
    const startedAt = new Date().toISOString();
    try {
      const page = await websiteData.fetchPage(body.url, options);
      options.signal?.throwIfAborted();
      page.metadata = htmlService.parse(page);
      page.robots = await robotsService.load(page.finalUrl, options);
      options.signal?.throwIfAborted();
      page.checks = seoService.analyze(page);
      return { ok: true, data: auditModel.createReport(page, startedAt) };
    } catch (error) {
      return { ok: false, code: error instanceof websiteData.WebsiteError ? error.code : 'INTERNAL_ERROR' };
    }
  }
};
