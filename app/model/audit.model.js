const version = '1.0';

module.exports = {
  version,
  createReport: (page, startedAt) => ({
    schemaVersion: version,
    status: 'partial',
    requestedUrl: page.requestedUrl,
    startedAt,
    completedAt: new Date().toISOString(),
    scope: { type: 'single-page', origin: new URL(page.finalUrl).origin, maxPages: 1 },
    coverage: { discovered: 1, fetched: 1, analyzed: 0, skipped: [], limitReached: false },
    summary: { pages: 1, critical: 0, warning: 0, review: 0, affected: 0 },
    pages: [{ ...page, fetchStatus: 'success', analysisStatus: 'not-checked', checks: [] }],
    issues: [],
    notChecked: [{
      id: 'seo-analysis', url: page.finalUrl, reason: 'not-implemented',
      message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c SEO'
    }],
    lighthouse: { status: 'not-checked', categories: [], reason: 'not-requested' }
  })
};
