const version = '1.0';

module.exports = {
  version,
  createReport: (page, startedAt) => {
    const checks = [...(page.checks || [])];
    const issues = checks.filter((entry) => ['fail', 'review'].includes(entry.outcome));
    const unavailable = checks.filter((entry) => entry.outcome === 'not-checked' || entry.complete === false);
    const notChecked = unavailable.map((entry) => ({
      id: entry.ruleId, url: entry.url, reason: entry.reason || 'incomplete', message: entry.found
    }));
    notChecked.push(
      { id: 'javascript-render', url: page.finalUrl, reason: 'not-implemented', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e23\u0e27\u0e08\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e2b\u0e25\u0e31\u0e07 JavaScript \u0e17\u0e33\u0e07\u0e32\u0e19' },
      { id: 'lighthouse', url: page.finalUrl, reason: 'not-requested', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e23\u0e35\u0e22\u0e01 engine \u0e15\u0e23\u0e27\u0e08\u0e04\u0e30\u0e41\u0e19\u0e19 Lighthouse' },
      { id: 'site-crawl', url: page.finalUrl, reason: 'outside-scope', message: '\u0e23\u0e2d\u0e1a\u0e19\u0e35\u0e49\u0e15\u0e23\u0e27\u0e08\u0e40\u0e09\u0e1e\u0e32\u0e30 URL \u0e17\u0e35\u0e48\u0e23\u0e30\u0e1a\u0e38 \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e44\u0e25\u0e48\u0e15\u0e23\u0e27\u0e08\u0e17\u0e31\u0e49\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c' },
      { id: 'canonical-target', url: page.finalUrl, reason: 'not-implemented', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e23\u0e27\u0e08\u0e04\u0e27\u0e32\u0e21\u0e2a\u0e31\u0e21\u0e1e\u0e31\u0e19\u0e18\u0e4c\u0e01\u0e31\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22 canonical' }
    );
    if (!checks.length) notChecked.unshift({ id: 'seo-analysis', url: page.finalUrl, reason: 'not-requested', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e01\u0e0e SEO' });
    return {
      schemaVersion: version,
      status: 'partial',
      requestedUrl: page.requestedUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      scope: { type: 'single-page', origin: new URL(page.finalUrl).origin, maxPages: 1 },
      coverage: { discovered: 1, fetched: 1, analyzed: checks.length ? 1 : 0, skipped: [], limitReached: false },
      summary: {
        pages: 1,
        critical: issues.filter((entry) => entry.severity === 'critical').length,
        warning: issues.filter((entry) => entry.severity === 'warning').length,
        review: issues.filter((entry) => entry.severity === 'review').length,
        affected: issues.length ? 1 : 0,
        checks: {
          pass: checks.filter((entry) => entry.outcome === 'pass').length,
          fail: checks.filter((entry) => entry.outcome === 'fail').length,
          review: checks.filter((entry) => entry.outcome === 'review').length,
          notChecked: checks.filter((entry) => entry.outcome === 'not-checked').length
        }
      },
      pages: [{ ...page, fetchStatus: 'success', analysisStatus: !checks.length ? 'not-checked' : unavailable.length ? 'partial' : 'complete', checks }],
      issues,
      notChecked,
      lighthouse: { status: 'not-checked', categories: [], reason: 'not-requested' }
    };
  }
};
