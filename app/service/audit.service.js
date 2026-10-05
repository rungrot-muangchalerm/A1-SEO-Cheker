const websiteData = require('../data/website.data');
const auditModel = require('../model/audit.model');

module.exports = {
  create: async (body, options = {}) => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.url !== 'string') {
      return { ok: false, code: 'INVALID_URL' };
    }
    const startedAt = new Date().toISOString();
    try {
      const page = await websiteData.fetchPage(body.url, options);
      return { ok: true, data: auditModel.createReport(page, startedAt) };
    } catch (error) {
      return { ok: false, code: error.code || 'NETWORK_ERROR' };
    }
  }
};
