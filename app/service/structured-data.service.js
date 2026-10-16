const semanticRules = require('./structured-data-rules.service');
const limits = Object.freeze({ maxScripts: 50, maxScriptBytes: 128 * 1024, maxTotalBytes: 512 * 1024, maxDepth: 64, maxNodes: 10000 });

function inspect(value) {
  const queue = [{ value, depth: 0, context: false }];
  const types = new Set();
  let nodes = 0;
  while (queue.length) {
    const item = queue.pop();
    if (++nodes > limits.maxNodes || item.depth > limits.maxDepth) return { complete: false, nodes, types: [...types], reason: 'jsonld-structure-limit' };
    if (!item.value || typeof item.value !== 'object') continue;
    if (!item.context && !Array.isArray(item.value)) {
      for (const type of [item.value['@type'] || []].flat()) if (typeof type === 'string' && types.size < 20) types.add(type);
    }
    for (const [key, child] of Object.entries(item.value)) queue.push({ value: child, depth: item.depth + 1, context: item.context || key === '@context' });
    if (queue.length + nodes > limits.maxNodes) return { complete: false, nodes, types: [...types], reason: 'jsonld-structure-limit' };
  }
  return { complete: true, nodes, types: [...types] };
}

module.exports = {
  limits,
  analyze: (page) => {
    const data = page.metadata.jsonLd;
    if (!data) return [];
    const semantics = [];
    const checks = data.scripts.map((script) => {
      let outcome = 'not-checked';
      let reason = script.reason;
      let syntax = 'not-checked';
      let shape = null;
      let observation = { complete: false, types: [], nodes: 0 };
      if (script.contentComplete) {
        let value;
        try { value = JSON.parse(script.content); syntax = 'valid'; }
        catch { syntax = 'invalid'; }
        if (syntax === 'invalid') outcome = 'fail';
        else {
          shape = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
          observation = inspect(value);
          if (observation.complete) semantics.push(...semanticRules.analyze(page, script, value));
          if (!observation.complete) reason = observation.reason;
          else outcome = ['object', 'array'].includes(shape) ? 'pass' : 'review';
        }
      }
      const complete = script.contentComplete && (syntax === 'invalid' || observation.complete);
      return {
        id: 'jsonld-syntax:' + script.index, ruleId: 'jsonld-syntax', ruleVersion: '1.0', url: page.finalUrl, urls: [page.finalUrl],
        category: 'onpage', title: 'JSON \u0e02\u0e2d\u0e07\u0e1a\u0e25\u0e47\u0e2d\u0e01 JSON-LD #' + script.index,
        groupTitle: 'JSON \u0e02\u0e2d\u0e07\u0e1a\u0e25\u0e47\u0e2d\u0e01 JSON-LD', outcome,
        severity: outcome === 'fail' ? 'warning' : outcome === 'review' ? 'review' : null, complete,
        ...(!complete ? { reason: reason || 'jsonld-structure-limit' } : {}),
        found: syntax === 'invalid' ? '\u0e2d\u0e48\u0e32\u0e19\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e19\u0e35\u0e49\u0e40\u0e1b\u0e47\u0e19 JSON \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49' : !complete ? '\u0e15\u0e23\u0e27\u0e08\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a: ' + reason :
          'JSON syntax \u0e16\u0e39\u0e01\u0e15\u0e49\u0e2d\u0e07 \u00b7 ' + shape + (outcome === 'review' ? ' \u00b7 \u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e23\u0e39\u0e1b\u0e41\u0e1a\u0e1a\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 JSON-LD' : ''),
        impact: '\u0e15\u0e23\u0e27\u0e08 JSON syntax \u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19 \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e02\u0e22\u0e32\u0e22 context \u0e2b\u0e23\u0e37\u0e2d\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e04\u0e27\u0e32\u0e21\u0e2b\u0e21\u0e32\u0e22\u0e15\u0e32\u0e21 JSON-LD/Schema.org; \u0e44\u0e21\u0e48\u0e23\u0e31\u0e1a\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19 rich results \u0e41\u0e25\u0e30\u0e44\u0e21\u0e48\u0e16\u0e37\u0e2d\u0e27\u0e48\u0e32\u0e17\u0e38\u0e01\u0e2b\u0e19\u0e49\u0e32\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35 structured data',
        steps: ['\u0e15\u0e23\u0e27\u0e08 JSON \u0e43\u0e19 script \u0e17\u0e35\u0e48\u0e23\u0e30\u0e1a\u0e38 \u0e41\u0e01\u0e49 comma, quote \u0e41\u0e25\u0e30\u0e01\u0e32\u0e23 escape \u0e15\u0e32\u0e21 JSON syntax',
          '\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 context/type \u0e41\u0e25\u0e30\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e01\u0e31\u0e1a\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e17\u0e35\u0e48\u0e1c\u0e39\u0e49\u0e43\u0e0a\u0e49\u0e40\u0e2b\u0e47\u0e19\u0e08\u0e23\u0e34\u0e07',
          '\u0e15\u0e23\u0e27\u0e08\u0e04\u0e38\u0e13\u0e2a\u0e21\u0e1a\u0e31\u0e15\u0e34\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e0a\u0e19\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e19 Rich Results Test \u0e44\u0e21\u0e48\u0e43\u0e0a\u0e49\u0e1c\u0e25 syntax \u0e40\u0e1b\u0e47\u0e19\u0e01\u0e32\u0e23\u0e23\u0e31\u0e1a\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19'],
        evidence: [{
          kind: script.kind, selector: script.selector, source: script.source, sourceTruncated: script.sourceTruncated,
          location: script.location, sourceFormat: 'serialized-html', sourceUrl: page.finalUrl, scriptIndex: script.index, complete: script.contentComplete
        }],
        details: {
          syntax, shape, observedLiteralTypes: observation.types, nodes: observation.nodes, bytes: script.bytes,
          scope: 'json-syntax-only', jsonLdProcessing: 'not-performed', richResults: 'not-checked', limits
        },
        references: [{ title: 'W3C JSON-LD', url: 'https://www.w3.org/TR/json-ld11/' },
        { title: 'Google Search Central', url: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data' }]
      };
    });
    if (!data.complete) checks.push({
      id: 'jsonld-extraction', ruleId: 'jsonld-extraction', ruleVersion: '1.0', url: page.finalUrl,
      urls: [page.finalUrl], category: 'onpage', title: '\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e01\u0e32\u0e23\u0e2d\u0e48\u0e32\u0e19 JSON-LD', outcome: 'not-checked', severity: null, complete: false,
      reason: 'jsonld-extraction-limit', found: '\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49 ' + data.scripts.length + ' \u0e08\u0e32\u0e01 ' + data.count + ' \u0e1a\u0e25\u0e47\u0e2d\u0e01 \u0e42\u0e14\u0e22\u0e21\u0e35\u0e25\u0e34\u0e21\u0e34\u0e15\u0e02\u0e19\u0e32\u0e14\u0e23\u0e27\u0e21',
      impact: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e23\u0e27\u0e08\u0e17\u0e38\u0e01\u0e1a\u0e25\u0e47\u0e2d\u0e01 \u0e44\u0e21\u0e48\u0e2a\u0e23\u0e38\u0e1b\u0e27\u0e48\u0e32\u0e1c\u0e48\u0e32\u0e19\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e19\u0e49\u0e32', steps: [],
      evidence: [{ kind: 'observation', sourceUrl: page.finalUrl, selector: 'script[type="application/ld+json"]', count: data.count, complete: false }],
      details: { limits, retainedBytes: data.bytes }, references: [{ title: 'W3C JSON-LD', url: 'https://www.w3.org/TR/json-ld11/' }]
    });
    return [...checks, ...semantics];
  }
};
