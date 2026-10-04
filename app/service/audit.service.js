const websiteData = require('../data/website.data');

module.exports = {
  create: async (body, options = {}) => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.url !== 'string') {
      return { ok: false, code: 'INVALID_URL' };
    }
    try {
      const page = await websiteData.fetchPage(body.url, options);
      return { ok: true, data: { status: 'fetched', page } };
    } catch (error) {
      return { ok: false, code: error.code || 'NETWORK_ERROR' };
    }
  }
};
