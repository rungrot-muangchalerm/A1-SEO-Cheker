const required = ['og:title', 'og:type', 'og:image', 'og:url'];
const urlProperties = new Set(['og:url', 'og:image', 'og:image:url', 'og:image:secure_url',
  'og:audio', 'og:audio:url', 'og:audio:secure_url', 'og:video', 'og:video:url', 'og:video:secure_url']);

module.exports = {
  analyze: (page) => {
    const info = page.metadata.openGraph;
    const entries = info?.entries || [];
    const complete = info?.complete === true;
    const successful = page.status >= 200 && page.status < 300;
    const findings = [];
    const evidence = [];
    const add = (code, property, message, observed = []) => {
      findings.push({ code, property, message });
      evidence.push(...(observed.length ? observed : [{
        kind: 'observation',
        selector: 'head meta[property="' + property + '"]', count: 0, complete
      }]));
    };
    if (successful) {
      for (const entry of entries.filter(entry => entry.inHead === false)) add('outside-head', entry.property,
        entry.property + ' \u0e2d\u0e22\u0e39\u0e48\u0e20\u0e32\u0e22\u0e19\u0e2d\u0e01 head \u0e04\u0e27\u0e23\u0e22\u0e49\u0e32\u0e22\u0e44\u0e1b head \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e2b\u0e49\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49\u0e15\u0e32\u0e21 protocol', [entry]);
      for (const property of [...required, 'og:description']) {
        const observed = entries.filter(entry => entry.property === property ||
          (property === 'og:image' && entry.property === 'og:image:url'));
        if (!observed.length && complete) add('missing-property', property,
          '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e1a ' + property + (property === 'og:description' ? ' (\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e40\u0e2a\u0e23\u0e34\u0e21\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e41\u0e0a\u0e23\u0e4c)' : ''), observed);
        else if (observed.some(entry => !entry.content.trim())) add('empty-property', property,
          property + ' \u0e21\u0e35\u0e04\u0e48\u0e32\u0e27\u0e48\u0e32\u0e07', observed.filter(entry => !entry.content.trim()));
        if (['og:title', 'og:type', 'og:url'].includes(property) && new Set(observed.map(entry => entry.content.trim())).size > 1) {
          add('multiple-values', property, property + ' \u0e21\u0e35\u0e2b\u0e25\u0e32\u0e22\u0e04\u0e48\u0e32 \u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2d\u0e32\u0e08\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e04\u0e48\u0e32\u0e15\u0e31\u0e27\u0e41\u0e23\u0e01 \u0e04\u0e27\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08', observed);
        }
      }
      const invalid = entries.filter(entry => {
        if (!urlProperties.has(entry.property) || !entry.content.trim()) return false;
        try {
          const url = new URL(entry.content.trim());
          return !['http:', 'https:'].includes(url.protocol) || !!(url.username || url.password);
        } catch { return true; }
      });
      for (const entry of invalid) add('invalid-url', entry.property,
        entry.property + ' \u0e04\u0e27\u0e23\u0e40\u0e1b\u0e47\u0e19 URL HTTP/HTTPS \u0e41\u0e1a\u0e1a\u0e40\u0e15\u0e47\u0e21\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e0a\u0e37\u0e48\u0e2d\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19', [entry]);
      const canonical = page.metadata.canonical;
      const canonicalComplete = !page.metadata.truncated.includes('canonical') && !page.metadata.linkHeaderError;
      const ogUrls = entries.filter(entry => entry.property === 'og:url');
      if (complete && canonicalComplete && canonical.length === 1 && canonical[0].url && !Object.keys(canonical[0].parameters || {}).length &&
        !new URL(canonical[0].url).username && !new URL(canonical[0].url).password && ogUrls.length === 1 &&
        !invalid.includes(ogUrls[0]) && ogUrls[0].resolvedUrl !== canonical[0].url) {
        add('canonical-mismatch', 'og:url', 'og:url \u0e15\u0e48\u0e32\u0e07\u0e08\u0e32\u0e01 canonical \u0e04\u0e27\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 URL \u0e2b\u0e25\u0e31\u0e01\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e43\u0e19\u0e01\u0e32\u0e23\u0e41\u0e0a\u0e23\u0e4c', [ogUrls[0], canonical[0]]);
      }
    }
    const outcome = !successful ? 'not-checked' : findings.length ? 'review' : complete ? 'pass' : 'not-checked';
    const found = !successful ? '\u0e44\u0e21\u0e48\u0e2a\u0e23\u0e38\u0e1b Open Graph \u0e02\u0e2d\u0e07\u0e2b\u0e19\u0e49\u0e32 HTTP ' + page.status :
      findings.length ? findings.map(entry => entry.message).join('; ') : complete ?
        '\u0e1e\u0e1a Open Graph \u0e2b\u0e25\u0e31\u0e01\u0e41\u0e25\u0e30 description \u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e27\u0e48\u0e32\u0e07 \u0e44\u0e21\u0e48\u0e1e\u0e1a URL \u0e1c\u0e34\u0e14\u0e23\u0e39\u0e1b\u0e41\u0e1a\u0e1a\u0e43\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49' : '\u0e2d\u0e48\u0e32\u0e19 Open Graph \u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a \u0e08\u0e36\u0e07\u0e22\u0e31\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e02\u0e32\u0e14\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49';
    return [{
      id: 'open-graph', ruleId: 'open-graph', ruleVersion: '1.0', category: 'sharing',
      url: page.finalUrl, urls: [page.finalUrl], title: 'Open Graph \u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e41\u0e0a\u0e23\u0e4c\u0e25\u0e34\u0e07\u0e01\u0e4c', outcome,
      severity: outcome === 'review' ? 'review' : null, complete: successful && complete,
      ...(!successful ? { reason: 'non-success-response' } : !complete ? { reason: 'metadata-limit' } : {}), found,
      impact: 'Open Graph \u0e0a\u0e48\u0e27\u0e22\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d \u0e23\u0e39\u0e1b \u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22 \u0e41\u0e25\u0e30 URL \u0e02\u0e2d\u0e07\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e17\u0e35\u0e48\u0e41\u0e0a\u0e23\u0e4c \u0e01\u0e32\u0e23\u0e02\u0e32\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e2b\u0e25\u0e31\u0e01\u0e10\u0e32\u0e19\u0e27\u0e48\u0e32\u0e40\u0e27\u0e47\u0e1a\u0e40\u0e02\u0e49\u0e32 index \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e2b\u0e23\u0e37\u0e2d\u0e2d\u0e31\u0e19\u0e14\u0e31\u0e1a\u0e15\u0e01 \u0e41\u0e25\u0e30\u0e1c\u0e25\u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 preview \u0e08\u0e23\u0e34\u0e07\u0e02\u0e2d\u0e07\u0e41\u0e1e\u0e25\u0e15\u0e1f\u0e2d\u0e23\u0e4c\u0e21',
      steps: ['\u0e2b\u0e32\u0e01\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49\u0e04\u0e27\u0e23\u0e41\u0e0a\u0e23\u0e4c\u0e44\u0e14\u0e49 \u0e40\u0e1e\u0e34\u0e48\u0e21 og:title, og:type, og:image \u0e41\u0e25\u0e30 og:url \u0e43\u0e19 head \u0e43\u0e2b\u0e49\u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e41\u0e0a\u0e23\u0e4c',
        '\u0e40\u0e1e\u0e34\u0e48\u0e21 og:description \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e21\u0e35\u0e1b\u0e23\u0e30\u0e42\u0e22\u0e0a\u0e19\u0e4c \u0e43\u0e0a\u0e49 URL HTTP/HTTPS \u0e41\u0e1a\u0e1a\u0e40\u0e15\u0e47\u0e21 \u0e41\u0e25\u0e30\u0e15\u0e23\u0e27\u0e08\u0e04\u0e48\u0e32\u0e27\u0e48\u0e32\u0e07\u0e2b\u0e23\u0e37\u0e2d\u0e2b\u0e25\u0e32\u0e22\u0e04\u0e48\u0e32\u0e17\u0e35\u0e48\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e31\u0e49\u0e07\u0e43\u0e08',
        '\u0e15\u0e23\u0e27\u0e08 og:url \u0e01\u0e31\u0e1a canonical \u0e15\u0e32\u0e21\u0e40\u0e08\u0e15\u0e19\u0e32 \u0e44\u0e21\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e43\u0e2b\u0e49 og:title \u0e2b\u0e23\u0e37\u0e2d og:description \u0e15\u0e23\u0e07\u0e01\u0e31\u0e1a title/meta description \u0e17\u0e38\u0e01\u0e15\u0e31\u0e27',
        '\u0e15\u0e23\u0e27\u0e08 HTML \u0e17\u0e35\u0e48\u0e40\u0e1c\u0e22\u0e41\u0e1e\u0e23\u0e48\u0e41\u0e25\u0e49\u0e27\u0e41\u0e25\u0e30 preview \u0e02\u0e2d\u0e07\u0e41\u0e1e\u0e25\u0e15\u0e1f\u0e2d\u0e23\u0e4c\u0e21 \u0e23\u0e39\u0e1b\u0e2b\u0e25\u0e32\u0e22\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e44\u0e14\u0e49 \u0e23\u0e30\u0e1a\u0e1a\u0e19\u0e35\u0e49\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b\u0e2b\u0e23\u0e37\u0e2d\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e27\u0e48\u0e32\u0e23\u0e39\u0e1b\u0e40\u0e02\u0e49\u0e32\u0e16\u0e36\u0e07\u0e44\u0e14\u0e49'],
      evidence: evidence.length ? [...new Set(evidence)] : entries.length ? entries : [{
        kind: 'observation',
        selector: 'head meta[property^="og:"]', count: 0, complete: successful && complete
      }],
      details: { scope: 'initial-html-sharing-metadata', findings, mediaFetched: false, previewValidated: false, rankingValidated: false },
      references: [{ title: 'Open Graph protocol', url: 'https://ogp.me/' }]
    }];
  }
};
