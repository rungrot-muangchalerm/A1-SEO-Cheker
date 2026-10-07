const { createHash } = require('node:crypto');
const robotsDirectives = require('./robots-directives.service');

const rules = [
  {
    id: 'duplicate-title', label: 'Title', field: 'titles', value: 'value', limited: 'titles',
    reference: 'https://developers.google.com/search/docs/appearance/title-link'
  },
  {
    id: 'duplicate-description', label: 'Meta description', field: 'descriptions', value: 'content', limited: 'meta',
    reference: 'https://developers.google.com/search/docs/appearance/snippet'
  }
];
const normalize = (value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

function pageContext(page) {
  const data = page.metadata;
  const headings = (data.headings || []).filter(entry => entry.level === 1);
  const robots = robotsDirectives.read({ ...page, headers: page.headers || {} });
  const targets = [...new Set(data.canonical.map(entry => entry.url).filter(Boolean))];
  return {
    url: page.finalUrl, h1: headings.slice(0, 5).map(entry => normalize(entry.value).slice(0, 512)),
    h1PreviewTruncated: headings.length > 5 || headings.some(entry => normalize(entry.value).length > 512),
    h1Complete: !data.truncated.includes('headings'),
    canonicalTargets: targets.slice(0, 10), canonicalTargetsOmitted: Math.max(0, targets.length - 10),
    canonicalComplete: !data.truncated.includes('canonical') && !data.linkHeaderError &&
      data.canonical.every(entry => entry.url && !new URL(entry.url).username && !new URL(entry.url).password &&
        !Object.keys(entry.parameters || {}).length),
    noindex: robots.noindex, noindexComplete: !robots.truncated,
    evidence: [...headings.slice(0, 5), ...data.canonical.slice(0, 10), ...robots.applicable.slice(0, 10).map(entry => entry.evidence)]
      .map(entry => ({ ...entry, sourceUrl: page.finalUrl, ...(entry.kind === 'html' ? { sourceFormat: 'serialized-html' } : {}) }))
  };
}

function duplicates(pages, rule) {
  const groups = new Map();
  const excluded = [];
  let incomplete = false;
  for (const page of pages) {
    const data = page.metadata;
    if (page.status < 200 || page.status >= 300) { excluded.push({ url: page.finalUrl, reason: 'non-success-response' }); continue; }
    if (!data || data.truncated.includes(rule.limited)) {
      incomplete = true; excluded.push({ url: page.finalUrl, reason: 'metadata-incomplete' }); continue;
    }
    const entries = data[rule.field];
    if (entries.length > 1) { incomplete = true; excluded.push({ url: page.finalUrl, reason: 'ambiguous-declaration' }); continue; }
    const value = normalize(entries[0]?.[rule.value]);
    if (!value) { excluded.push({ url: page.finalUrl, reason: 'empty-value' }); continue; }
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push({ page, entry: entries[0] });
  }
  const eligible = [...groups.values()].reduce((sum, group) => sum + group.length, 0);
  const repeated = [...groups].filter(([, group]) => group.length > 1);
  const base = {
    ruleId: rule.id, ruleVersion: '1.1', category: 'onpage',
    title: rule.label + ' \u0e0b\u0e49\u0e33\u0e23\u0e30\u0e2b\u0e27\u0e48\u0e32\u0e07\u0e2b\u0e19\u0e49\u0e32',
    impact: '\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e2d\u0e32\u0e08\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e15\u0e48\u0e32\u0e07\u0e01\u0e31\u0e19\u0e44\u0e14\u0e49\u0e44\u0e21\u0e48\u0e0a\u0e31\u0e14 \u0e41\u0e15\u0e48\u0e2d\u0e32\u0e08\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e0b\u0e49\u0e33\u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08; \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e2d\u0e31\u0e19\u0e14\u0e31\u0e1a\u0e2b\u0e23\u0e37\u0e2d\u0e2a\u0e16\u0e32\u0e19\u0e30 index',
    steps: ['\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e02\u0e2d\u0e07 URL \u0e17\u0e35\u0e48\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e02\u0e49\u0e2d\u0e07 \u0e41\u0e25\u0e30\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e0b\u0e49\u0e33\u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48',
      '\u0e2b\u0e32\u0e01\u0e40\u0e1b\u0e47\u0e19\u0e04\u0e19\u0e25\u0e30\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32 \u0e1b\u0e23\u0e31\u0e1a ' + rule.label + ' \u0e43\u0e2b\u0e49\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e41\u0e15\u0e48\u0e25\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e40\u0e08\u0e32\u0e30\u0e08\u0e07',
      '\u0e15\u0e23\u0e27\u0e08 HTML \u0e17\u0e35\u0e48\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48\u0e41\u0e25\u0e30\u0e15\u0e23\u0e27\u0e08\u0e0b\u0e49\u0e33\u0e2b\u0e25\u0e31\u0e07\u0e41\u0e01\u0e49\u0e44\u0e02'],
    references: [{ title: 'Google Search Central', url: rule.reference }],
    details: {
      examinedPages: pages.length, eligiblePages: eligible, excluded,
      normalization: 'trim-collapse-whitespace-case-sensitive', coverage: 'fetched-2xx-html-only'
    }
  };
  if (!repeated.length) {
    const available = eligible > 1 && !incomplete;
    return [{
      ...base, id: rule.id, url: pages[0]?.finalUrl || null, urls: pages.map((page) => page.finalUrl),
      outcome: available ? 'pass' : 'not-checked', severity: null, complete: available,
      ...(available ? {} : { reason: incomplete ? 'metadata-incomplete' : 'insufficient-pages' }),
      found: available ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e0b\u0e49\u0e33\u0e43\u0e19 ' + eligible + ' \u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a' :
        '\u0e22\u0e31\u0e07\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a ' + rule.label + ' \u0e0b\u0e49\u0e33\u0e23\u0e30\u0e2b\u0e27\u0e48\u0e32\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e14\u0e49\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a',
      evidence: [{ kind: 'observation', scope: 'fetched-pages', count: 0, examined: eligible, complete: available }]
    }];
  }
  return repeated.map(([value, group]) => {
    const urls = group.map(({ page }) => page.finalUrl).sort();
    const hash = createHash('sha256').update(value).digest('hex');
    const contexts = group.map(({ page }) => pageContext(page)).sort((a, b) => a.url.localeCompare(b.url));
    const headingSignatures = new Set(group.filter(({ page }) => !page.metadata.truncated.includes('headings'))
      .map(({ page }) => (page.metadata.headings || []).filter(entry => entry.level === 1).map(entry => normalize(entry.value)))
      .filter(values => values.length && values.every(Boolean)).map(values => JSON.stringify(values)));
    const sharedCanonical = contexts.every(entry => entry.canonicalComplete && entry.canonicalTargets.length === 1) &&
      new Set(contexts.map(entry => entry.canonicalTargets[0])).size === 1 ? contexts[0].canonicalTargets[0] : null;
    const reuse = {
      matchedPages: group.length, eligiblePages: eligible, allEligiblePages: group.length === eligible,
      distinctObservedH1: headingSignatures.size, sharedDeclaredCanonical: sharedCanonical,
      noindexPages: contexts.filter(entry => entry.noindex).length,
      contentEquivalenceValidated: false, googleCanonicalValidated: false,
      pages: contexts.slice(0, 50), pagesOmitted: Math.max(0, contexts.length - 50)
    };
    const contextMessage = ' \u0e43\u0e0a\u0e49\u0e23\u0e48\u0e27\u0e21\u0e01\u0e31\u0e19 ' + group.length + '/' + eligible + ' \u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a\u0e44\u0e14\u0e49' +
      (reuse.allEligiblePages ? ' (\u0e17\u0e38\u0e01\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e40\u0e02\u0e49\u0e32\u0e40\u0e07\u0e37\u0e48\u0e2d\u0e19\u0e44\u0e02\u0e43\u0e19\u0e23\u0e2d\u0e1a\u0e19\u0e35\u0e49)' : '') +
      (headingSignatures.size > 1 ? '; \u0e1e\u0e1a H1 \u0e15\u0e48\u0e32\u0e07\u0e01\u0e31\u0e19 ' + headingSignatures.size + ' \u0e0a\u0e38\u0e14 \u0e04\u0e27\u0e23\u0e15\u0e23\u0e27\u0e08\u0e27\u0e48\u0e32 template \u0e43\u0e0a\u0e49\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e23\u0e48\u0e27\u0e21\u0e01\u0e31\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e04\u0e19\u0e25\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48' : '') +
      (sharedCanonical ? '; \u0e17\u0e38\u0e01 URL \u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 canonical \u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19 \u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e01\u0e48\u0e2d\u0e19\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21' : '') +
      (reuse.noindexPages ? '; \u0e1e\u0e1a noindex \u0e43\u0e19 ' + reuse.noindexPages + ' \u0e2b\u0e19\u0e49\u0e32 \u0e15\u0e49\u0e2d\u0e07\u0e41\u0e22\u0e01\u0e40\u0e08\u0e15\u0e19\u0e32 index \u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e2b\u0e19\u0e49\u0e32\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49' : '');
    return {
      ...base, id: rule.id + ':' + hash, url: urls[0], urls, outcome: 'review', severity: 'review', complete: !incomplete,
      ...(incomplete ? { reason: 'metadata-incomplete' } : {}),
      found: '\u0e1e\u0e1a ' + rule.label + ' \u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e43\u0e19 ' + urls.length + ' \u0e2b\u0e19\u0e49\u0e32: ' + value.slice(0, 512) +
        (value.length > 512 ? ' (\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e22\u0e48\u0e2d)' : '') + contextMessage,
      steps: [...base.steps.slice(0, 2),
        '\u0e15\u0e23\u0e27\u0e08\u0e01\u0e32\u0e23\u0e2a\u0e48\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e41\u0e15\u0e48\u0e25\u0e30 route \u0e40\u0e02\u0e49\u0e32 layout \u0e40\u0e0a\u0e48\u0e19 \u0e2b\u0e19\u0e49\u0e32\u0e41\u0e23\u0e01 \u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 \u0e41\u0e25\u0e30\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19 \u0e04\u0e27\u0e23\u0e43\u0e0a\u0e49\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e15\u0e32\u0e21\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48 \u0e44\u0e21\u0e48\u0e04\u0e31\u0e14\u0e25\u0e2d\u0e01\u0e0a\u0e37\u0e48\u0e2d\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e23\u0e01\u0e17\u0e38\u0e01\u0e2b\u0e19\u0e49\u0e32',
      ...(sharedCanonical ? ['\u0e2b\u0e32\u0e01\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e0b\u0e49\u0e33\u0e42\u0e14\u0e22\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08 \u0e43\u0e2b\u0e49\u0e15\u0e23\u0e27\u0e08 URL \u0e2b\u0e25\u0e31\u0e01 \u0e25\u0e34\u0e07\u0e01\u0e4c\u0e20\u0e32\u0e22\u0e43\u0e19 \u0e41\u0e25\u0e30 canonical \u0e01\u0e48\u0e2d\u0e19 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19 title \u0e40\u0e1e\u0e35\u0e22\u0e07\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e17\u0e33\u0e43\u0e2b\u0e49 URL \u0e0b\u0e49\u0e33\u0e14\u0e39\u0e15\u0e48\u0e32\u0e07\u0e01\u0e31\u0e19'] : []),
      ...(reuse.noindexPages ? ['\u0e2b\u0e19\u0e49\u0e32 noindex \u0e22\u0e31\u0e07\u0e04\u0e27\u0e23\u0e21\u0e35\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e48\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e40\u0e02\u0e49\u0e32\u0e43\u0e08 \u0e41\u0e15\u0e48\u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e1b\u0e34\u0e14 index \u0e40\u0e1e\u0e35\u0e22\u0e07\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e41\u0e01\u0e49\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e0b\u0e49\u0e33'] : []), base.steps[2]],
      details: { ...base.details, valuePreview: value.slice(0, 512), valueTruncated: value.length > 512, valueHash: hash, reuse },
      evidence: group.map(({ page, entry }) => ({ ...entry, sourceUrl: page.finalUrl, sourceFormat: 'serialized-html' }))
    };
  });
}

module.exports = {
  analyze: (pages) => {
    if (!pages.length) return [];
    const unique = [...new Map(pages.map((page) => [page.finalUrl, page])).values()];
    return rules.flatMap((rule) => duplicates(unique, rule));
  }
};
