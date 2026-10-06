const { createHash } = require('node:crypto');
const website = require('../data/website.data');
const responses = require('../model/response.model');

const limits = Object.freeze({ maxTargets: require('../config/crawl.config').discovery.maxUrls, maxEvidencePerTarget: 200 });
const reference = 'https://developers.google.com/crawling/docs/troubleshooting/http-status-codes';

function check(pages, target, sources, outcome, reason, result, evidenceOmitted = 0) {
  const urls = [...new Set(sources.map((entry) => entry.sourceUrl))].sort();
  const status = result.available ? result.status : null;
  const loop = reason === 'REDIRECT_LOOP';
  const known = outcome !== 'not-checked';
  const evidence = sources.map((entry) => ({ ...entry, sourceFormat: 'serialized-html' }));
  const observation = result.available ? result : result.observation;
  if (observation) evidence.push({ kind: 'response', sourceUrl: observation.url, url: observation.url,
    status: observation.status, redirects: result.redirects || [], terminal: !!result.available, fetchError: observation.fetchError || null });
  return {
    id: 'internal-link-target:' + createHash('sha256').update(target).digest('hex'), ruleId: 'internal-link-target', ruleVersion: '1.0',
    url: urls[0] || pages[0].finalUrl, urls, category: 'links',
    title: loop ? '\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19 redirect \u0e27\u0e19\u0e0b\u0e49\u0e33' : '\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e02\u0e2d\u0e07\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19',
    outcome, severity: outcome === 'fail' ? 'warning' : outcome === 'review' ? 'review' : null,
    complete: known && evidenceOmitted === 0,
    ...(known && !evidenceOmitted ? {} : { reason: evidenceOmitted ? 'link-evidence-limit' : reason }),
    found: target + ' \u00b7 ' + (status ? 'HTTP ' + status : loop ? '\u0e40\u0e01\u0e34\u0e14 redirect \u0e27\u0e19\u0e0b\u0e49\u0e33 \u0e44\u0e21\u0e48\u0e21\u0e35 HTTP \u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07' :
      '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e17\u0e23\u0e32\u0e1a HTTP \u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07: ' + reason),
    impact: '\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e17\u0e35\u0e48\u0e40\u0e02\u0e49\u0e32\u0e16\u0e36\u0e07\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e2d\u0e32\u0e08\u0e01\u0e23\u0e30\u0e17\u0e1a\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e41\u0e25\u0e30 crawler; 401/403 \u0e2d\u0e32\u0e08\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08\u0e08\u0e33\u0e01\u0e31\u0e14\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c \u0e41\u0e25\u0e30 429/5xx \u0e2d\u0e32\u0e08\u0e40\u0e1b\u0e47\u0e19\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e0a\u0e31\u0e48\u0e27\u0e04\u0e23\u0e32\u0e27',
    steps: ['\u0e15\u0e23\u0e27\u0e08 URL \u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e41\u0e25\u0e30\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e40\u0e08\u0e15\u0e19\u0e32\u0e02\u0e2d\u0e07\u0e2a\u0e16\u0e32\u0e19\u0e30 HTTP',
      '\u0e41\u0e01\u0e49 href \u0e17\u0e35\u0e48\u0e2b\u0e19\u0e49\u0e32\u0e15\u0e49\u0e19\u0e17\u0e32\u0e07 \u0e2b\u0e23\u0e37\u0e2d\u0e41\u0e01\u0e49\u0e40\u0e2a\u0e49\u0e19\u0e17\u0e32\u0e07\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07/redirect \u0e15\u0e32\u0e21\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e08\u0e23\u0e34\u0e07',
      '\u0e15\u0e23\u0e27\u0e08\u0e0b\u0e49\u0e33\u0e2b\u0e25\u0e31\u0e07\u0e41\u0e01\u0e49\u0e44\u0e02 \u0e44\u0e21\u0e48\u0e40\u0e14\u0e32 HTTP \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e16\u0e39\u0e01\u0e02\u0e49\u0e32\u0e21\u0e2b\u0e23\u0e37\u0e2d\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49'],
    evidence, references: [{ title: 'Google Crawling Infrastructure', url: reference }],
    details: { target, responseUrl: observation?.url || null, httpStatus: status, lastHttpStatus: observation?.status || null,
      redirects: result.redirects || [], reusedResponse: !!result.reusedResponse, evidenceOmitted }
  };
}

module.exports = {
  limits,
  analyze: (crawl) => {
    const index = responses.createIndex(crawl.responses, crawl);
    const origin = new URL(crawl.page.finalUrl).origin;
    const targets = new Map();
    const sourceUrls = new Map();
    let omittedLinks = 0;
    let invalidLinks = 0;
    const invalidEvidence = [];
    let incomplete = false;
    for (const page of crawl.pages) {
      if (page.metadata.truncated.includes('links')) incomplete = true;
      for (const link of page.metadata.links) {
        if (!link.url || new URL(link.url).origin !== origin) continue;
        let target;
        try { target = website.parseUrl(link.url, crawl).href; } catch (error) {
          invalidLinks++; incomplete = true;
          if (invalidEvidence.length < 20) invalidEvidence.push({ kind: 'html', selector: link.selector, source: link.source,
            location: link.location, sourceTruncated: link.sourceTruncated, sourceUrl: page.finalUrl, reason: error.code,
            urlPreview: link.url.slice(0, 512), urlTruncated: link.url.length > 512 });
          continue;
        }
        if (!targets.has(target)) {
          if (targets.size >= limits.maxTargets) { omittedLinks++; incomplete = true; continue; }
          targets.set(target, { evidence: [], omitted: 0 });
          sourceUrls.set(target, new Set());
        }
        sourceUrls.get(target).add(page.finalUrl);
        const group = targets.get(target);
        if (group.evidence.length < limits.maxEvidencePerTarget) group.evidence.push({ ...link, sourceUrl: page.finalUrl });
        else group.omitted++;
      }
    }
    const checks = [];
    let checked = 0;
    const skipped = new Map(crawl.skipped.map((entry) => [entry.url, entry.reason]));
    for (const [target, group] of targets) {
      const result = index.get(target);
      const loop = !result.available && result.reason === 'REDIRECT_LOOP';
      if (result.available || loop) checked++;
      if (!result.available && !loop || result.status >= 300 || loop) {
        const outcome = !result.available && !loop ? 'not-checked' : [401, 403, 429].includes(result.status) || result.status >= 300 && result.status < 400 ? 'review' : 'fail';
        const reason = result.reason === 'not-fetched' ? skipped.get(target) || result.reason : result.reason;
        const finding = check(crawl.pages, target, group.evidence, outcome, reason || 'not-fetched', result, group.omitted);
        finding.urls = [...sourceUrls.get(target)].sort();
        finding.url = finding.urls[0];
        checks.push(finding);
      }
    }
    const available = checked === targets.size && !incomplete;
    checks.push({ id: 'internal-link-coverage', ruleId: 'internal-link-coverage', ruleVersion: '1.0', url: crawl.page.finalUrl,
      urls: crawl.pages.map((page) => page.finalUrl), category: 'links', title: '\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08 HTTP \u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19',
      outcome: available ? 'pass' : 'not-checked', severity: null, complete: available,
      ...(available ? {} : { reason: incomplete ? 'link-extraction-limit' : 'link-targets-unavailable' }),
      found: '\u0e15\u0e23\u0e27\u0e08 HTTP/redirect \u0e44\u0e14\u0e49 ' + checked + ' \u0e08\u0e32\u0e01 ' + targets.size + ' URL \u0e20\u0e32\u0e22\u0e43\u0e19\u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49',
      impact: '\u0e40\u0e09\u0e1e\u0e32\u0e30 href \u0e43\u0e19 HTML \u0e17\u0e35\u0e48\u0e14\u0e36\u0e07\u0e44\u0e14\u0e49 \u0e44\u0e21\u0e48\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32 \u0e2a\u0e16\u0e32\u0e19\u0e30 index \u0e25\u0e34\u0e07\u0e01\u0e4c JavaScript \u0e2b\u0e23\u0e37\u0e2d anchor \u0e20\u0e32\u0e22\u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32',
      steps: [], references: [{ title: 'Google Crawling Infrastructure', url: reference }],
      evidence: [{ kind: 'observation', scope: 'fetched-pages', examined: checked, count: targets.size, complete: available }, ...invalidEvidence],
      details: { checkedTargets: checked, retainedTargets: targets.size, omittedLinks, invalidLinks, limits } });
    return checks;
  }
};
