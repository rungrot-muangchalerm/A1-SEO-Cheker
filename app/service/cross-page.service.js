const { createHash } = require('node:crypto');

const rules = [
  { id: 'duplicate-title', label: 'Title', field: 'titles', value: 'value', limited: 'titles',
    reference: 'https://developers.google.com/search/docs/appearance/title-link' },
  { id: 'duplicate-description', label: 'Meta description', field: 'descriptions', value: 'content', limited: 'meta',
    reference: 'https://developers.google.com/search/docs/appearance/snippet' }
];
const normalize = (value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

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
    ruleId: rule.id, ruleVersion: '1.0', category: 'onpage',
    title: rule.label + ' \u0e0b\u0e49\u0e33\u0e23\u0e30\u0e2b\u0e27\u0e48\u0e32\u0e07\u0e2b\u0e19\u0e49\u0e32',
    impact: '\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e2d\u0e32\u0e08\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e15\u0e48\u0e32\u0e07\u0e01\u0e31\u0e19\u0e44\u0e14\u0e49\u0e44\u0e21\u0e48\u0e0a\u0e31\u0e14 \u0e41\u0e15\u0e48\u0e2d\u0e32\u0e08\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e0b\u0e49\u0e33\u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08; \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e2d\u0e31\u0e19\u0e14\u0e31\u0e1a\u0e2b\u0e23\u0e37\u0e2d\u0e2a\u0e16\u0e32\u0e19\u0e30 index',
    steps: ['\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e02\u0e2d\u0e07 URL \u0e17\u0e35\u0e48\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e02\u0e49\u0e2d\u0e07 \u0e41\u0e25\u0e30\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e0b\u0e49\u0e33\u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48',
      '\u0e2b\u0e32\u0e01\u0e40\u0e1b\u0e47\u0e19\u0e04\u0e19\u0e25\u0e30\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32 \u0e1b\u0e23\u0e31\u0e1a ' + rule.label + ' \u0e43\u0e2b\u0e49\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22\u0e41\u0e15\u0e48\u0e25\u0e30\u0e2b\u0e19\u0e49\u0e32\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e40\u0e08\u0e32\u0e30\u0e08\u0e07',
      '\u0e15\u0e23\u0e27\u0e08 HTML \u0e17\u0e35\u0e48\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48\u0e41\u0e25\u0e30\u0e15\u0e23\u0e27\u0e08\u0e0b\u0e49\u0e33\u0e2b\u0e25\u0e31\u0e07\u0e41\u0e01\u0e49\u0e44\u0e02'],
    references: [{ title: 'Google Search Central', url: rule.reference }],
    details: { examinedPages: pages.length, eligiblePages: eligible, excluded,
      normalization: 'trim-collapse-whitespace-case-sensitive', coverage: 'fetched-2xx-html-only' }
  };
  if (!repeated.length) {
    const available = eligible > 1 && !incomplete;
    return [{ ...base, id: rule.id, url: pages[0]?.finalUrl || null, urls: pages.map((page) => page.finalUrl),
      outcome: available ? 'pass' : 'not-checked', severity: null, complete: available,
      ...(available ? {} : { reason: incomplete ? 'metadata-incomplete' : 'insufficient-pages' }),
      found: available ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e0b\u0e49\u0e33\u0e43\u0e19 ' + eligible + ' \u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a' :
        '\u0e22\u0e31\u0e07\u0e40\u0e1b\u0e23\u0e35\u0e22\u0e1a\u0e40\u0e17\u0e35\u0e22\u0e1a ' + rule.label + ' \u0e0b\u0e49\u0e33\u0e23\u0e30\u0e2b\u0e27\u0e48\u0e32\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e14\u0e49\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a',
      evidence: [{ kind: 'observation', scope: 'fetched-pages', count: 0, examined: eligible, complete: available }] }];
  }
  return repeated.map(([value, group]) => {
    const urls = group.map(({ page }) => page.finalUrl).sort();
    const hash = createHash('sha256').update(value).digest('hex');
    return { ...base, id: rule.id + ':' + hash, url: urls[0], urls, outcome: 'review', severity: 'review', complete: !incomplete,
      ...(incomplete ? { reason: 'metadata-incomplete' } : {}),
      found: '\u0e1e\u0e1a ' + rule.label + ' \u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e19\u0e43\u0e19 ' + urls.length + ' \u0e2b\u0e19\u0e49\u0e32: ' + value.slice(0, 512) +
        (value.length > 512 ? ' (\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e22\u0e48\u0e2d)' : ''),
      details: { ...base.details, valuePreview: value.slice(0, 512), valueTruncated: value.length > 512, valueHash: hash },
      evidence: group.map(({ page, entry }) => ({ ...entry, sourceUrl: page.finalUrl, sourceFormat: 'serialized-html' })) };
  });
}

module.exports = {
  analyze: (pages) => {
    if (!pages.length) return [];
    const unique = [...new Map(pages.map((page) => [page.finalUrl, page])).values()];
    return rules.flatMap((rule) => duplicates(unique, rule));
  }
};
