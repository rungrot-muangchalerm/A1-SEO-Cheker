module.exports = {
  analyze: (lhr) => {
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
    let passed = 0, total = 0, informational = 0, excluded = 0;
    const audits = [];
    for (const ref of refs) {
      if (typeof ref?.id !== 'string' || ref.id.length > 128 || seen.has(ref.id)) return unavailable('incomplete-audit-evidence');
      seen.add(ref.id);
      const result = Object.hasOwn(lhr.audits || {}, ref.id) && lhr.audits[ref.id];
      if (!result || !['binary', 'numeric', 'error', 'informative', 'manual', 'notApplicable'].includes(result.scoreDisplayMode)) return unavailable('incomplete-audit-evidence');
      if (ref.group === 'hidden' || ['manual', 'notApplicable'].includes(result.scoreDisplayMode)) { ++excluded; continue; }
      if (result.scoreDisplayMode === 'informative') { ++informational; continue; }
      const score = result.score;
      if (result.scoreDisplayMode !== 'error' && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)) return unavailable('incomplete-audit-evidence');
      // Match Lighthouse's pass threshold; errors are counted but never passed.
      const pass = result.scoreDisplayMode !== 'error' && score >= 0.9;
      ++total;
      if (pass) ++passed;
      audits.push({ id: ref.id, mode: result.scoreDisplayMode, passed: pass });
    }
    return { status: total ? 'completed' : 'not-checked', ...(total ? {} : { reason: 'no-applicable-audits' }),
      displayMode: 'fraction', passed, total, informational, excluded, audits };
  }
};
