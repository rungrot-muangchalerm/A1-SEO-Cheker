const { createHash } = require('node:crypto');
const responses = require('../model/response.model');
const html = require('./html.service');
const robots = require('./robots-directives.service');

const limits = Object.freeze({ maxTargets: require('../config/crawl.config').discovery.maxUrls, maxEvidencePerTarget: 50 });
const reference = 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap';

function check(url, ruleId, title, outcome, complete, reason, found, evidence, details) {
  return {
    id: ruleId + ':' + createHash('sha256').update(url).digest('hex'), ruleId, ruleVersion: '1.0', url, urls: [url],
    category: 'index', title, outcome, severity: outcome === 'fail' ? 'warning' : outcome === 'review' ? 'review' : null,
    complete, ...(!complete ? { reason } : {}), found,
    impact: 'Sitemap \u0e40\u0e2a\u0e19\u0e2d URL \u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e49\u0e19\u0e1e\u0e1a \u0e41\u0e15\u0e48\u0e44\u0e21\u0e48\u0e23\u0e31\u0e1a\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19 index \u0e2b\u0e23\u0e37\u0e2d\u0e2d\u0e31\u0e19\u0e14\u0e31\u0e1a; noindex \u0e41\u0e25\u0e30 redirect \u0e2d\u0e32\u0e08\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08 \u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e19\u0e42\u0e22\u0e1a\u0e32\u0e22\u0e02\u0e2d\u0e07\u0e40\u0e27\u0e47\u0e1a',
    steps: ['\u0e15\u0e23\u0e27\u0e08 loc \u0e43\u0e19\u0e44\u0e1f\u0e25\u0e4c sitemap \u0e17\u0e35\u0e48\u0e23\u0e30\u0e1a\u0e38 \u0e40\u0e17\u0e35\u0e22\u0e1a\u0e01\u0e31\u0e1a HTTP \u0e41\u0e25\u0e30\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e02\u0e2d\u0e07 URL \u0e08\u0e23\u0e34\u0e07',
      '\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 URL \u0e2b\u0e25\u0e31\u0e01\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23 index \u0e01\u0e48\u0e2d\u0e19\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19 sitemap, redirect \u0e2b\u0e23\u0e37\u0e2d noindex',
      '\u0e15\u0e23\u0e27\u0e08\u0e0b\u0e49\u0e33\u0e2b\u0e25\u0e31\u0e07\u0e41\u0e01\u0e49 \u0e41\u0e25\u0e30\u0e14\u0e39\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e17\u0e35\u0e48 Google \u0e23\u0e39\u0e49\u0e08\u0e31\u0e01\u0e43\u0e19 Search Console \u0e02\u0e2d\u0e07\u0e40\u0e08\u0e49\u0e32\u0e02\u0e2d\u0e07\u0e40\u0e27\u0e47\u0e1a'],
    evidence, details, references: [{ title: 'Google Search Central', url: reference }]
  };
}

module.exports = {
  limits,
  analyze: (crawl) => {
    const index = responses.createIndex(crawl.responses, crawl);
    const pages = new Map(crawl.pages.map((page) => [page.finalUrl, page]));
    const skipped = new Map(crawl.skipped.map((entry) => [entry.url, entry.reason]));
    const maps = crawl.discovery.sitemaps.filter((entry) => entry.status === 'checked' && entry.type === 'urlset');
    const targets = new Map();
    const checks = [];
    let invalidEntries = 0;
    let restrictedEntries = 0;
    let omittedEntries = 0;
    let incomplete = maps.some((entry) => entry.truncated) || crawl.discovery.sitemaps.some((entry) => entry.status !== 'checked');
    for (const map of maps) {
      const sourceUrl = map.finalUrl || map.url;
      const invalid = [];
      const restricted = [];
      let invalidCount = 0;
      let restrictedCount = 0;
      for (const entry of map.entries) {
        const proof = { ...entry, sourceUrl, sourceFormat: 'parsed-xml-value', namespaceVerified: map.namespaceVerified };
        if (!entry.url) {
          let policyRestricted = false;
          try {
            const candidate = new URL(entry.value);
            policyRestricted = ['http:', 'https:'].includes(candidate.protocol) &&
              (!!candidate.port || !!candidate.username || !!candidate.password || entry.value.length > 8192);
          } catch { }
          if (policyRestricted) {
            restrictedEntries++; restrictedCount++;
            if (restricted.length < limits.maxEvidencePerTarget) restricted.push(proof);
            continue;
          }
          invalidEntries++; invalidCount++;
          if (invalid.length < limits.maxEvidencePerTarget) invalid.push(proof);
          continue;
        }
        if (!targets.has(entry.url)) {
          if (targets.size >= limits.maxTargets) { omittedEntries++; incomplete = true; continue; }
          targets.set(entry.url, { evidence: [], files: new Set(), omitted: 0 });
        }
        const group = targets.get(entry.url);
        group.files.add(sourceUrl);
        if (group.evidence.length < limits.maxEvidencePerTarget) group.evidence.push(proof);
        else group.omitted++;
      }
      if (restrictedCount) {
        incomplete = true;
        checks.push(check(sourceUrl, 'sitemap-restricted-loc', 'URL \u0e43\u0e19 sitemap \u0e19\u0e2d\u0e01\u0e19\u0e42\u0e22\u0e1a\u0e32\u0e22\u0e01\u0e32\u0e23\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25', 'not-checked', false,
          'url-policy-restriction', '\u0e1e\u0e1a URL \u0e17\u0e35\u0e48 checker \u0e44\u0e21\u0e48\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15\u0e43\u0e2b\u0e49\u0e14\u0e36\u0e07 ' + restrictedCount + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 ' + sourceUrl,
          restricted, { restrictedEntries: restrictedCount, evidenceOmitted: restrictedCount - restricted.length, sitemapFiles: [sourceUrl] }));
      }
      if (invalidCount) {
        incomplete = true;
        checks.push(check(sourceUrl, 'sitemap-invalid-loc', 'URL \u0e43\u0e19 sitemap \u0e44\u0e21\u0e48\u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07', 'fail', invalidCount === invalid.length,
          'sitemap-evidence-limit', '\u0e1e\u0e1a loc \u0e17\u0e35\u0e48\u0e43\u0e0a\u0e49\u0e40\u0e1b\u0e47\u0e19 URL \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 ' + invalidCount + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u00b7 ' + sourceUrl,
          invalid, { invalidEntries: invalidCount, evidenceOmitted: invalidCount - invalid.length, sitemapFiles: [sourceUrl] }));
      }
    }
    let examined = 0;
    for (const [targetUrl, group] of targets) {
      const result = index.get(targetUrl);
      const observation = result.available ? result : result.observation;
      const proof = [...group.evidence];
      const facts = [];
      let complete = false;
      let reason = new URL(targetUrl).origin !== crawl.discovery.origin ? 'outside-origin' :
        result.reason === 'not-fetched' ? skipped.get(targetUrl) || 'not-fetched' : result.reason;
      const details = {
        target: targetUrl, responseUrl: observation?.url || null,
        httpStatus: result.available ? result.status : null, lastHttpStatus: observation?.status || null,
        redirects: result.redirects || [], targetNoindex: null, sitemapFiles: [...group.files].sort(), evidenceOmitted: group.omitted, facts
      };
      if (observation) proof.push({
        kind: 'response', sourceUrl: observation.url, status: observation.status,
        redirects: details.redirects, terminal: result.available, fetchError: observation.fetchError || null
      });
      if (details.redirects.length || observation?.status >= 300 && observation.status < 400) facts.push({ code: 'sitemap-url-redirect', message: '\u0e1e\u0e1a redirect \u0e02\u0e2d\u0e07 URL \u0e43\u0e19 sitemap' });
      const loop = !result.available && result.reason === 'REDIRECT_LOOP';
      if (loop) facts.push({ code: 'sitemap-url-http-loop', message: '\u0e40\u0e01\u0e34\u0e14 redirect \u0e27\u0e19\u0e0b\u0e49\u0e33' });
      if (result.available && (result.status < 200 || result.status >= 300)) {
        complete = true;
        facts.push({ code: 'sitemap-url-http-status', message: 'URL \u0e43\u0e19 sitemap \u0e15\u0e2d\u0e1a HTTP ' + result.status });
      } else if (result.available) {
        const targetPage = pages.get(result.url);
        const page = targetPage || {
          finalUrl: result.url, headers: result.headers || {}, rawHeaders: result.rawHeaders || [],
          metadata: html.parse({ finalUrl: result.url, html: '', headers: result.headers })
        };
        const directives = robots.read(page);
        details.targetNoindex = directives.noindex ? true : targetPage && !directives.truncated ? false : null;
        details.targetMetadataScope = targetPage ? 'initial-html-and-headers' : 'headers-only';
        complete = !!targetPage && !directives.truncated;
        if (!complete) reason = !targetPage ? 'target-body-unavailable' : 'target-robots-incomplete';
        if (directives.noindex) {
          facts.push({ code: 'sitemap-url-noindex', message: 'URL \u0e43\u0e19 sitemap \u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 noindex \u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e19\u0e42\u0e22\u0e1a\u0e32\u0e22 index' });
          proof.push(...directives.applicable.map((entry) => ({
            ...entry.evidence, sourceUrl: page.finalUrl,
            ...(entry.evidence.kind === 'html' ? { sourceFormat: 'serialized-html' } : {})
          })));
        }
      }
      if (loop) complete = true;
      if (complete) examined++;
      details.evidenceOmitted += Math.max(0, proof.length - limits.maxEvidencePerTarget);
      if (details.evidenceOmitted) { complete = false; reason = 'sitemap-evidence-limit'; incomplete = true; }
      const priority = proof.filter((entry) => entry.kind !== 'sitemap');
      const selected = [...group.evidence.slice(0, 1), ...priority, ...group.evidence.slice(1)].slice(0, limits.maxEvidencePerTarget);
      const failed = loop || result.available && result.status >= 400 && ![401, 403, 429].includes(result.status);
      const outcome = failed ? 'fail' : facts.length ? 'review' : complete ? 'pass' : 'not-checked';
      if (outcome !== 'pass') checks.push(check(targetUrl, 'sitemap-url-target', 'URL \u0e43\u0e19 sitemap', outcome, complete, reason || 'target-unavailable',
        targetUrl + ' \u00b7 ' + (details.httpStatus ? 'HTTP ' + details.httpStatus + ' \u00b7 ' : '') +
        (facts.length ? facts.map((fact) => fact.message).join('; ') : '\u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a') + (!complete ? '; \u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a: ' + reason : ''), selected, details));
    }
    const complete = maps.length > 0 && examined === targets.size && !incomplete;
    const coverage = check(crawl.page.finalUrl, 'sitemap-url-coverage', '\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08 URL \u0e43\u0e19 sitemap', complete ? 'pass' : 'not-checked', complete,
      !maps.length ? 'no-readable-urlset' : incomplete ? 'sitemap-coverage-incomplete' : 'sitemap-targets-unavailable',
      '\u0e15\u0e23\u0e27\u0e08 URL \u0e44\u0e14\u0e49 ' + examined + ' \u0e08\u0e32\u0e01 ' + targets.size + ' \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 \u0e43\u0e19 urlset \u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49 ' + maps.length + ' \u0e44\u0e1f\u0e25\u0e4c',
      [{ kind: 'observation', sourceUrl: crawl.page.finalUrl, scope: 'parsed-urlsets-and-observed-responses', count: targets.size, examined, complete }],
      { examinedTargets: examined, retainedTargets: targets.size, parsedUrlsets: maps.length, invalidEntries, restrictedEntries, omittedEntries, limits });
    coverage.steps = [];
    checks.push(coverage);
    return checks;
  }
};
