module.exports = {
  analyze: (lhr, blocked = {}) => {
    const unavailable = (reason) => ({ status: 'not-checked', reason });
    const agent = lhr?.environment?.hostUserAgent || lhr?.userAgent;
    const match = typeof agent === 'string' && agent.match(/(?:HeadlessChrome|Chrome|Chromium)\/(\d+)\./);
    if (!match || !lhr.lighthouseVersion) return unavailable('engine-version-unavailable');
    if (Number(match[1]) < 150) return unavailable('engine-not-supported');
    const category = lhr.categories?.['agentic-browsing'];
    if (!category) return unavailable('not-returned-by-provider');
    if (category.categoryScoreDisplayMode !== 'fraction') return unavailable('unsupported-result-format');
    const refs = category.auditRefs;
    if (!Array.isArray(refs) || !refs.length || refs.length > 500) return unavailable('incomplete-audit-evidence');
    const seen = new Set();
    let passed = 0, total = 0, informational = 0, excluded = 0, notChecked = 0;
    let enginePassed = 0, engineTotal = 0, engineComplete = true;
    const audits = [];
    for (const ref of refs) {
      if (typeof ref?.id !== 'string' || !ref.id.length || ref.id.length > 128 || seen.has(ref.id)) return unavailable('incomplete-audit-evidence');
      seen.add(ref.id);
      const result = Object.hasOwn(lhr.audits || {}, ref.id) && lhr.audits[ref.id];
      if (ref.group === 'hidden') { ++excluded; continue; }
      const row = { id: ref.id, title: ref.id, status: 'not-checked', passed: null, evidence: [] };
      if (typeof result?.scoreDisplayMode === 'string' && result.scoreDisplayMode.length <= 32) row.mode = result.scoreDisplayMode;
      const clipped = (value, max) => {
        if (typeof value !== 'string') return undefined;
        if (value.length > max) row.truncated = true;
        return value.slice(0, max);
      };
      row.title = clipped(result?.title, 256) || ref.id;
      for (const [key, max] of [['description', 2048], ['displayValue', 512]]) {
        const value = clipped(result?.[key], max); if (value !== undefined) row[key] = value;
      }
      const valid = result && ['binary', 'numeric', 'error', 'informative', 'manual', 'notApplicable'].includes(result.scoreDisplayMode);
      const scoreValid = typeof result?.score === 'number' && Number.isFinite(result.score) && result.score >= 0 && result.score <= 1;
      if (!valid || (['binary', 'numeric'].includes(row.mode) && !scoreValid)) {
        row.reason = 'incomplete-audit-evidence'; engineComplete = false; ++notChecked;
      } else {
        const passable = ['binary', 'numeric', 'error'].includes(row.mode);
        if (passable) { ++engineTotal; if (row.mode !== 'error' && result.score >= 0.9) ++enginePassed; }
        if (blocked[ref.id] || row.mode === 'error') {
          row.reason = blocked[ref.id] || 'audit-runtime-error'; ++notChecked;
        } else if (row.mode === 'informative') { row.status = 'informational'; ++informational; }
        else if (['manual', 'notApplicable'].includes(row.mode)) { row.status = row.mode === 'manual' ? 'manual' : 'not-applicable'; ++excluded; }
        else {
          row.score = result.score;
          row.passed = result.score >= 0.9;
          row.status = row.passed ? 'pass' : 'fail';
          ++total; if (row.passed) ++passed;
        }
        if (row.status !== 'not-checked') {
          const explanation = clipped(result.explanation, 2048); if (explanation !== undefined) row.explanation = explanation;
          // Keep bounded, useful text/node evidence, never raw executable report HTML.
          const queue = [result.details];
          let visited = 0;
          while (queue.length && visited++ < 100 && row.evidence.length < 20) {
            const item = queue.shift();
            if (!item || typeof item !== 'object') continue;
            if (item.type === 'list-section' && item.value && typeof item.value === 'object') { queue.push(item.value); continue; }
            if (Array.isArray(item.items)) { queue.push(...item.items.slice(0, 100)); if (item.items.length > 100) row.truncated = true; continue; }
            const evidence = {};
            for (const key of ['message', 'description', 'element', 'issue', 'severity', 'name', 'location']) {
              const value = clipped(item[key], 1024); if (value !== undefined) evidence[key] = value;
            }
            const node = item.node || (item.element?.type === 'node' ? item.element : undefined);
            for (const key of ['selector', 'snippet']) {
              const value = clipped(node?.[key], 2048); if (value !== undefined) evidence[key] = value;
            }
            if (Object.keys(evidence).length) row.evidence.push(evidence);
          }
          if (queue.length) row.truncated = true;
        }
      }
      audits.push(row);
    }
    return { status: total ? (notChecked ? 'partial' : 'completed') : 'not-checked',
      ...(notChecked ? { reason: 'incomplete-audit-evidence' } : total ? {} : { reason: 'no-applicable-audits' }),
      displayMode: 'fraction', passed, total, failed: total - passed, notChecked, informational, excluded,
      ...(engineComplete ? { engineFraction: { passed: enginePassed, total: engineTotal } } : {}), audits };
  }
};
