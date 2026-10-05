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
    coverage: { discovered: 1, fetched: 1, analyzed: page.checks?.length ? 1 : 0, skipped: [], limitReached: false },
    summary: {
      pages: 1,
      critical: (page.checks || []).filter((entry) => entry.severity === 'critical').length,
      warning: (page.checks || []).filter((entry) => entry.severity === 'warning').length,
      review: (page.checks || []).filter((entry) => entry.severity === 'review').length,
      affected: (page.checks || []).some((entry) => ['fail', 'review'].includes(entry.outcome)) ? 1 : 0
    },
    pages: [{ ...page, fetchStatus: 'success', analysisStatus: page.checks?.length ? 'partial' : 'not-checked', checks: [...(page.checks || [])] }],
    issues: (page.checks || []).filter((entry) => ['fail', 'review'].includes(entry.outcome)),
    notChecked: [{
      id: 'seo-analysis', url: page.finalUrl, reason: 'not-implemented',
      message: '\u0e22\u0e31\u0e07\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c SEO \u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a\u0e17\u0e38\u0e01\u0e01\u0e0e'
    }],
    lighthouse: { status: 'not-checked', categories: [], reason: 'not-requested' }
  })
};
