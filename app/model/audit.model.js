const version = '1.0';

module.exports = {
  version,
  createReport: (page, startedAt, discovery, crawl, siteChecks = []) => {
    const pages = (crawl?.pages || [page]).map((item) => {
      const checks = (item.checks || []).map((entry) => crawl ? { ...entry, id: entry.ruleId + ':' + entry.url } : entry);
      return { ...item, fetchStatus: 'success', analysisStatus: !checks.length ? 'not-checked' :
        checks.some((entry) => entry.outcome === 'not-checked' || entry.complete === false) ? 'partial' : 'complete', checks };
    });
    const checks = [...pages.flatMap((item) => item.checks), ...siteChecks];
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
    if (crawl) {
      const scope = notChecked.find((entry) => entry.id === 'site-crawl');
      scope.reason = crawl.stopReason || 'bounded-discovery';
      scope.message = '\u0e15\u0e23\u0e27\u0e08\u0e40\u0e09\u0e1e\u0e32\u0e30 URL \u0e17\u0e35\u0e48\u0e04\u0e49\u0e19\u0e1e\u0e1a\u0e43\u0e19\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15 \u0e44\u0e21\u0e48\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e04\u0e23\u0e1a\u0e17\u0e31\u0e49\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c';
      for (const skipped of crawl.skipped) notChecked.push({ id: 'page-crawl', ...skipped,
        message: '\u0e02\u0e49\u0e32\u0e21 URL: ' + skipped.url });
      for (const item of pages.slice(1)) {
        notChecked.push({ id: 'javascript-render', url: item.finalUrl, reason: 'not-implemented', message: 'JavaScript: ' + item.finalUrl },
          { id: 'canonical-target', url: item.finalUrl, reason: 'not-implemented', message: 'Canonical target: ' + item.finalUrl });
      }
    }
    if (discovery) {
      const crawl = notChecked.find((entry) => entry.id === 'site-crawl');
      if (crawl.reason === 'outside-scope') {
        crawl.reason = 'not-implemented';
        crawl.message = '\u0e04\u0e49\u0e19\u0e1e\u0e1a URL \u0e41\u0e25\u0e49\u0e27 \u0e41\u0e15\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e44\u0e25\u0e48\u0e15\u0e23\u0e27\u0e08\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e17\u0e38\u0e01\u0e2b\u0e19\u0e49\u0e32';
      }
      for (const sitemap of discovery.sitemaps.filter((entry) => entry.status === 'not-checked')) {
        notChecked.push({ id: 'sitemap-discovery', url: sitemap.url, reason: sitemap.reason,
          message: '\u0e2d\u0e48\u0e32\u0e19 sitemap \u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08: ' + sitemap.url });
      }
      if (discovery.limitReached || !discovery.linkExtractionComplete) notChecked.push({ id: 'url-discovery', url: page.finalUrl,
        reason: 'discovery-limit', message: '\u0e01\u0e32\u0e23\u0e04\u0e49\u0e19\u0e2b\u0e32 URL \u0e16\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e08\u0e33\u0e01\u0e31\u0e14' });
    }
    return {
      schemaVersion: version,
      status: 'partial',
      requestedUrl: page.requestedUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      scope: { type: crawl ? 'same-origin-crawl' : discovery ? 'same-origin-discovery' : 'single-page', origin: new URL(page.finalUrl).origin,
        maxPages: crawl ? crawl.limits.maxPages : 1 },
      coverage: { discovered: discovery ? discovery.urls.length : 1, fetched: pages.length, analyzed: pages.filter((item) => item.checks.length).length,
        skipped: crawl?.skipped || [], limitReached: !!(crawl?.limitReached || discovery?.limitReached) },
      summary: {
        pages: pages.length,
        critical: issues.filter((entry) => entry.severity === 'critical').length,
        warning: issues.filter((entry) => entry.severity === 'warning').length,
        review: issues.filter((entry) => entry.severity === 'review').length,
        affected: new Set(issues.flatMap((entry) => entry.urls)).size,
        checks: {
          pass: checks.filter((entry) => entry.outcome === 'pass').length,
          fail: checks.filter((entry) => entry.outcome === 'fail').length,
          review: checks.filter((entry) => entry.outcome === 'review').length,
          notChecked: checks.filter((entry) => entry.outcome === 'not-checked').length
        }
      },
      pages,
      ...(crawl ? { siteChecks } : {}),
      issues,
      notChecked,
      ...(discovery ? { discovery } : {}),
      ...(crawl ? { crawl: { limits: crawl.limits, stats: crawl.stats, stopReason: crawl.stopReason } } : {}),
      lighthouse: { status: 'not-checked', categories: [], reason: 'not-requested' }
    };
  }
};
