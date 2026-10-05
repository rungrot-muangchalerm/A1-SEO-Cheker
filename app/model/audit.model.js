const version = '1.0';

module.exports = {
  version,
  createReport: (page, startedAt, discovery, crawl, siteChecks = []) => {
    const pages = (crawl?.pages || [page]).map((item) => {
      const checks = (item.checks || []).map((entry) => crawl ? { ...entry, id: entry.id + ':' + entry.url } : entry);
      return { ...item, fetchStatus: 'success', analysisStatus: !checks.length ? 'not-checked' :
        checks.some((entry) => entry.outcome === 'not-checked' || entry.complete === false) ? 'partial' : 'complete', checks };
    });
    const checks = [...pages.flatMap((item) => item.checks), ...siteChecks];
    const issues = checks.filter((entry) => ['fail', 'review'].includes(entry.outcome));
    const grouped = new Map();
    for (const issue of issues) {
      if (!grouped.has(issue.ruleId)) grouped.set(issue.ruleId, {
        id: 'issue-group:' + issue.ruleId, ruleId: issue.ruleId, title: issue.groupTitle || issue.title,
        category: issue.category, count: 0, issueIds: [], urls: new Set(),
        severityCounts: { critical: 0, warning: 0, review: 0 }, complete: true
      });
      const group = grouped.get(issue.ruleId);
      ++group.count;
      ++group.severityCounts[issue.severity];
      group.issueIds.push(issue.id);
      issue.urls.forEach((url) => group.urls.add(url));
      if (issue.complete === false) group.complete = false;
    }
    const issueGroups = [...grouped.values()].map((group) => ({ ...group, urls: [...group.urls].sort() }));
    const unavailable = checks.filter((entry) => entry.outcome === 'not-checked' || entry.complete === false);
    const notChecked = unavailable.map((entry) => ({
      id: entry.ruleId, url: entry.url, reason: entry.reason || 'incomplete', message: entry.found
    }));
    for (const item of pages.filter((entry) => entry.metadata?.jsonLd?.count)) notChecked.push({ id: 'jsonld-semantics', url: item.finalUrl,
      reason: 'outside-scope', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 context/\u0e04\u0e27\u0e32\u0e21\u0e2b\u0e21\u0e32\u0e22 JSON-LD \u0e2b\u0e23\u0e37\u0e2d\u0e04\u0e38\u0e13\u0e2a\u0e21\u0e1a\u0e31\u0e15\u0e34 rich results' });
    for (const item of pages.filter((entry) => entry.metadata?.openGraph?.complete === false)) notChecked.push({ id: 'open-graph', url: item.finalUrl,
      reason: 'metadata-limit', message: '\u0e2d\u0e48\u0e32\u0e19 Open Graph \u0e44\u0e14\u0e49\u0e1a\u0e32\u0e07\u0e2a\u0e48\u0e27\u0e19\u0e40\u0e1e\u0e23\u0e32\u0e30\u0e25\u0e34\u0e21\u0e34\u0e15 metadata' });
    notChecked.push(
      ...(!page.render || page.render.status !== 'completed' ? [{ id: 'javascript-render', url: page.finalUrl,
        reason: page.render?.reason || (page.render ? 'render-incomplete' : 'not-requested'),
        message: 'JavaScript: ' + page.finalUrl }] : []),
      { id: 'lighthouse', url: page.finalUrl, reason: 'not-requested', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e23\u0e35\u0e22\u0e01 engine \u0e15\u0e23\u0e27\u0e08\u0e04\u0e30\u0e41\u0e19\u0e19 Lighthouse' },
      { id: 'site-crawl', url: page.finalUrl, reason: 'outside-scope', message: '\u0e23\u0e2d\u0e1a\u0e19\u0e35\u0e49\u0e15\u0e23\u0e27\u0e08\u0e40\u0e09\u0e1e\u0e32\u0e30 URL \u0e17\u0e35\u0e48\u0e23\u0e30\u0e1a\u0e38 \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e44\u0e25\u0e48\u0e15\u0e23\u0e27\u0e08\u0e17\u0e31\u0e49\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c' }
    );
    if (!siteChecks.some((entry) => entry.ruleId === 'canonical-target')) notChecked.push({ id: 'canonical-target', url: page.finalUrl,
      reason: 'not-requested', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e40\u0e17\u0e35\u0e22\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22 canonical \u0e43\u0e19\u0e23\u0e2d\u0e1a\u0e19\u0e35\u0e49' });
    if (!checks.length) notChecked.unshift({ id: 'seo-analysis', url: page.finalUrl, reason: 'not-requested', message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e01\u0e0e SEO' });
    if (crawl) {
      const scope = notChecked.find((entry) => entry.id === 'site-crawl');
      scope.reason = crawl.stopReason || 'bounded-discovery';
      scope.message = '\u0e15\u0e23\u0e27\u0e08\u0e40\u0e09\u0e1e\u0e32\u0e30 URL \u0e17\u0e35\u0e48\u0e04\u0e49\u0e19\u0e1e\u0e1a\u0e43\u0e19\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15 \u0e44\u0e21\u0e48\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e04\u0e23\u0e1a\u0e17\u0e31\u0e49\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c';
      for (const skipped of crawl.skipped) notChecked.push({ id: 'page-crawl', ...skipped,
        message: '\u0e02\u0e49\u0e32\u0e21 URL: ' + skipped.url });
      for (const item of pages.slice(1)) {
        if (item.render?.status !== 'completed') notChecked.push({ id: 'javascript-render', url: item.finalUrl,
          reason: item.render?.reason || (item.render ? 'render-incomplete' : 'not-requested'), message: 'JavaScript: ' + item.finalUrl });
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
      issueGroups,
      notChecked,
      ...(discovery ? { discovery } : {}),
      ...(crawl ? { crawl: { limits: crawl.limits, stats: crawl.stats, stopReason: crawl.stopReason }, responses: crawl.responses } : {}),
      lighthouse: { status: 'not-checked', categories: [], reason: 'not-requested' }
    };
  }
};
