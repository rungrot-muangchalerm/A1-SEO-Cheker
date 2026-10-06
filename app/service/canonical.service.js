const website = require('../data/website.data');
const responses = require('../model/response.model');
const html = require('./html.service');
const robots = require('./robots-directives.service');

const reference = 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls';

function declarations(metadata, options = {}) {
  if (metadata.truncated.includes('canonical') || metadata.linkHeaderError) return { reason: 'canonical-declarations-incomplete' };
  if (!metadata.canonical.length) return { reason: 'no-canonical-declaration' };
  if (metadata.canonical.some((entry) => Object.keys(entry.parameters || {}).length)) return { reason: 'canonical-annotation-parameters' };
  const targets = [];
  try {
    for (const entry of metadata.canonical) targets.push(website.parseUrl(entry.url, options).href);
  } catch { return { reason: 'invalid-canonical-declaration' }; }
  if (new Set(targets).size !== 1) return { reason: 'conflicting-canonical-declarations' };
  return { target: targets[0] };
}

function evidence(page, entries) {
  return entries.map((entry) => ({ ...entry, sourceUrl: page.finalUrl,
    ...(entry.kind === 'html' ? { sourceFormat: 'serialized-html' } : {}) }));
}

module.exports = {
  analyze: (crawl) => {
    const index = responses.createIndex(crawl.responses, crawl);
    const pages = new Map(crawl.pages.map((page) => [page.finalUrl, page]));
    const skipped = new Map(crawl.skipped.map((entry) => [entry.url, entry.reason]));
    const origin = new URL(crawl.page.finalUrl).origin;
    return crawl.pages.map((page) => {
      const declared = declarations(page.metadata, crawl);
      const facts = [];
      const entries = evidence(page, page.metadata.canonical);
      const details = { declaredTargets: page.metadata.canonical.map((entry) => entry.url || entry.value),
        target: declared.target || null, responseUrl: null, httpStatus: null, lastHttpStatus: null, redirects: [],
        selfReferential: declared.target === page.finalUrl, targetNoindex: null, targetCanonicalTargets: [],
        contentComparison: 'not-performed', scope: 'observed-responses-and-initial-html', facts };
      let outcome = 'not-checked';
      let reason = declared.reason;
      let complete = false;
      if (reason === 'canonical-annotation-parameters') {
        outcome = 'review';
        facts.push({ code: reason, message: '\u0e1e\u0e1a\u0e1e\u0e32\u0e23\u0e32\u0e21\u0e34\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e02\u0e2d\u0e07 canonical \u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e15\u0e23\u0e27\u0e08\u0e1a\u0e23\u0e34\u0e1a\u0e17\u0e40\u0e1e\u0e34\u0e48\u0e21' });
      }
      if (declared.target) {
        const crossOrigin = new URL(declared.target).origin !== origin;
        const result = index.get(declared.target);
        const observation = result.available ? result : result.observation;
        details.responseUrl = observation?.url || null;
        details.httpStatus = result.available ? result.status : null;
        details.lastHttpStatus = observation?.status || null;
        details.redirects = result.redirects || [];
        if (observation) entries.push({ kind: 'response', sourceUrl: observation.url, status: observation.status,
          redirects: details.redirects, terminal: result.available, fetchError: observation.fetchError || null });
        if (!details.selfReferential) facts.push({ code: 'different-canonical-target',
          message: '\u0e0a\u0e35\u0e49 canonical \u0e44\u0e1b\u0e2d\u0e35\u0e01 URL \u0e2d\u0e32\u0e08\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08\u0e23\u0e27\u0e21\u0e2b\u0e19\u0e49\u0e32\u0e0b\u0e49\u0e33 \u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e41\u0e25\u0e30\u0e40\u0e08\u0e15\u0e19\u0e32' });
        if (page.metadata.canonical.some((entry) => new URL(entry.url).hash)) facts.push({ code: 'canonical-fragment',
          message: 'Canonical \u0e21\u0e35 URL fragment \u0e04\u0e27\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 URL \u0e02\u0e2d\u0e07\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23' });
        if (details.redirects.length) facts.push({ code: 'canonical-redirect', message: '\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07 canonical \u0e21\u0e35 redirect' });
        const loop = !result.available && result.reason === 'REDIRECT_LOOP';
        if (loop) facts.push({ code: 'canonical-http-loop', message: '\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07 canonical redirect \u0e27\u0e19\u0e0b\u0e49\u0e33' });
        if (!result.available) reason = crossOrigin ? 'outside-origin' : result.reason === 'not-fetched' ? skipped.get(declared.target) || 'not-fetched' : result.reason;
        else if (result.status < 200 || result.status >= 300) {
          complete = true;
          facts.push({ code: 'canonical-http-status', message: '\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07 canonical \u0e15\u0e2d\u0e1a HTTP ' + result.status });
        } else {
          const targetPage = pages.get(result.url);
          const target = targetPage || { finalUrl: result.url, headers: result.headers || {}, rawHeaders: result.rawHeaders || [],
            metadata: html.parse({ finalUrl: result.url, html: '', headers: result.headers }) };
          const directives = robots.read(target);
          details.targetNoindex = directives.noindex ? true : targetPage && !directives.truncated ? false : null;
          details.targetMetadataScope = targetPage ? 'initial-html-and-headers' : 'headers-only';
          details.targetCanonicalTargets = target.metadata.canonical.map((entry) => entry.url || entry.value);
          if (directives.noindex || directives.hasExpiration) {
            facts.push({ code: directives.noindex ? 'canonical-target-noindex' : 'canonical-target-expiration',
              message: directives.noindex ? '\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07 canonical \u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 noindex \u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e19\u0e42\u0e22\u0e1a\u0e32\u0e22 index' : '\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07 canonical \u0e21\u0e35 unavailable_after \u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e40\u0e27\u0e25\u0e32' });
            entries.push(...evidence(target, directives.applicable.map((entry) => entry.evidence)));
          }
          const next = declarations(target.metadata, crawl);
          if (next.reason && next.reason !== 'no-canonical-declaration') entries.push(...evidence(target, target.metadata.canonical));
          if (next.target && next.target !== result.url) {
            facts.push({ code: next.target === page.finalUrl && !details.selfReferential ? 'canonical-cycle' : 'canonical-chain',
              message: '\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22\u0e21\u0e35 canonical \u0e0a\u0e35\u0e49\u0e15\u0e48\u0e2d\u0e44\u0e1b\u0e17\u0e35\u0e48 ' + next.target });
            entries.push(...evidence(target, target.metadata.canonical));
          }
          complete = !!targetPage && !directives.truncated && !['canonical-declarations-incomplete', 'invalid-canonical-declaration',
            'conflicting-canonical-declarations', 'canonical-annotation-parameters'].includes(next.reason);
          if (!complete) reason = !targetPage ? 'target-body-unavailable' : directives.truncated ? 'target-robots-incomplete' : next.reason;
        }
        const failed = loop || result.available && result.status >= 400 && ![401, 403, 429].includes(result.status);
        outcome = failed ? 'fail' : facts.length ? 'review' : complete ? 'pass' : 'not-checked';
        if (loop) complete = true;
      }
      details.evidenceOmitted = Math.max(0, entries.length - 200);
      if (details.evidenceOmitted) {
        complete = false; reason = 'canonical-evidence-limit';
        if (outcome === 'pass') outcome = 'not-checked';
      }
      // Retain response/directive proof before repeated declaration snippets when evidence is capped.
      const proof = entries.filter((entry) => entry.kind === 'response' || entry.name === 'X-Robots-Tag' || ['robots', 'googlebot'].includes(entry.name));
      const proofEntries = new Set(proof);
      const selected = [...proof, ...entries.filter((entry) => !proofEntries.has(entry))].slice(0, 200);
      return { id: 'canonical-target:' + page.finalUrl, ruleId: 'canonical-target', ruleVersion: '1.0', url: page.finalUrl,
        urls: [page.finalUrl], category: 'index', title: '\u0e40\u0e17\u0e35\u0e22\u0e1a canonical \u0e01\u0e31\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22', outcome,
        severity: outcome === 'fail' ? 'warning' : outcome === 'review' ? 'review' : null, complete,
        ...(!complete ? { reason: reason || 'target-unavailable' } : {}),
        found: (declared.target || page.finalUrl) + ' \u00b7 ' + (details.httpStatus ? 'HTTP ' + details.httpStatus + ' \u00b7 ' : '') +
          (facts.length ? facts.map((fact) => fact.message).join('; ') : complete ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e04\u0e27\u0e32\u0e21\u0e02\u0e31\u0e14\u0e41\u0e22\u0e49\u0e07\u0e43\u0e19\u0e2a\u0e48\u0e27\u0e19\u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49' : '\u0e22\u0e31\u0e07\u0e40\u0e17\u0e35\u0e22\u0e1a\u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a: ' + reason) +
          (!complete && facts.length ? '; \u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a: ' + reason : ''),
        impact: 'Canonical \u0e40\u0e1b\u0e47\u0e19\u0e2a\u0e31\u0e0d\u0e0d\u0e32\u0e13\u0e40\u0e2a\u0e19\u0e2d URL \u0e2b\u0e25\u0e31\u0e01 \u0e44\u0e21\u0e48\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32 Google \u0e08\u0e30\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e15\u0e32\u0e21 \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e31\u0e14\u0e2a\u0e34\u0e19\u0e27\u0e48\u0e32\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e0b\u0e49\u0e33\u0e08\u0e23\u0e34\u0e07\u0e2b\u0e23\u0e37\u0e2d\u0e15\u0e49\u0e2d\u0e07 index \u0e17\u0e38\u0e01\u0e2b\u0e19\u0e49\u0e32',
        steps: ['\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 URL \u0e2b\u0e25\u0e31\u0e01\u0e41\u0e25\u0e30\u0e40\u0e08\u0e15\u0e19\u0e32\u0e23\u0e27\u0e21\u0e2b\u0e19\u0e49\u0e32\u0e0b\u0e49\u0e33 \u0e40\u0e17\u0e35\u0e22\u0e1a\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e08\u0e23\u0e34\u0e07\u0e01\u0e48\u0e2d\u0e19\u0e41\u0e01\u0e49',
          '\u0e15\u0e23\u0e27\u0e08 HTTP, redirect, noindex \u0e41\u0e25\u0e30 canonical \u0e02\u0e2d\u0e07 URL \u0e40\u0e1b\u0e49\u0e32\u0e2b\u0e21\u0e32\u0e22\u0e08\u0e32\u0e01\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19',
          '\u0e15\u0e23\u0e27\u0e08 Google-selected canonical \u0e43\u0e19 Search Console \u0e02\u0e2d\u0e07\u0e40\u0e08\u0e49\u0e32\u0e02\u0e2d\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e41\u0e25\u0e30\u0e15\u0e23\u0e27\u0e08\u0e0b\u0e49\u0e33\u0e2b\u0e25\u0e31\u0e07\u0e41\u0e01\u0e49'],
        evidence: selected.length ? selected : [{ kind: 'observation', sourceUrl: page.finalUrl, selector: 'head link[rel~="canonical"]', header: 'Link', count: 0 }],
        references: [{ title: 'Google Search Central', url: reference }], details };
    });
  }
};
