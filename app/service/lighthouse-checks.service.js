const groups = ['best-practices', 'seo'];
const additional = ['html-has-lang', 'heading-order', 'viewport-insight'];
const reference = 'https://developer.chrome.com/docs/lighthouse/';

function evidence(details) {
  const queue = [details];
  const records = [];
  let visited = 0;
  let truncated = false;
  while (queue.length && visited++ < 100 && records.length < 20) {
    const item = queue.shift();
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'list-section' && item.value) { queue.push(item.value); continue; }
    if (Array.isArray(item.items)) {
      queue.push(...item.items.slice(0, 100));
      truncated ||= item.items.length > 100;
      continue;
    }
    const record = {};
    for (const key of ['message', 'description', 'url', 'name', 'statusCode']) {
      if (typeof item[key] === 'string') {
        record[key] = item[key].slice(0, 1024);
        truncated ||= item[key].length > 1024;
      } else if (key === 'statusCode' && Number.isInteger(item[key])) record[key] = item[key];
    }
    const node = item.node || (item.element?.type === 'node' ? item.element : undefined);
    for (const key of ['selector', 'snippet']) if (typeof node?.[key] === 'string') {
      record[key] = node[key].slice(0, 2048);
      truncated ||= node[key].length > 2048;
    }
    if (Object.keys(record).length) records.push(record);
  }
  return { evidence: records, evidenceTruncated: truncated || queue.length > 0 };
}

module.exports = {
  analyze: (lhr) => {
    const refs = new Map();
    const coverage = [];
    for (const group of groups) {
      const categoryRefs = lhr.categories?.[group]?.auditRefs;
      if (Array.isArray(categoryRefs) && categoryRefs.length > 100) coverage.push({
        id: group + '-audit-coverage', category: group, title: group + ' audit coverage', status: 'not-checked',
        reason: 'audit-ref-limit', found: 'Retained at most 100 of ' + categoryRefs.length + ' audit references.', evidence: [],
        references: [{ title: 'Lighthouse', url: reference }]
      });
      for (const ref of (Array.isArray(categoryRefs) ? categoryRefs : []).slice(0, 100)) {
        if (typeof ref?.id === 'string' && ref.id.length > 0 && ref.id.length <= 128 && ref.group !== 'hidden' && !refs.has(ref.id)) refs.set(ref.id, group);
      }
    }
    for (const id of ['is-on-https', ...additional]) if (!refs.has(id)) refs.set(id, id === 'viewport-insight' ? 'performance' : additional.includes(id) ? 'accessibility' : 'best-practices');
    const checks = [...refs].map(([id, category]) => {
      const value = Object.hasOwn(lhr.audits || {}, id) ? lhr.audits[id] : undefined;
      const short = (text, max) => typeof text === 'string' ? text.slice(0, max) : undefined;
      let status = 'not-checked';
      let reason = 'audit-result-unavailable';
      if (value?.scoreDisplayMode === 'error') reason = 'audit-runtime-error';
      else if (['binary', 'numeric'].includes(value?.scoreDisplayMode) && typeof value.score === 'number' && Number.isFinite(value.score) && value.score >= 0 && value.score <= 1) {
        status = value.score >= 0.9 ? 'pass' : 'fail'; reason = undefined;
      } else if (['notApplicable', 'manual', 'informative'].includes(value?.scoreDisplayMode)) {
        status = value.scoreDisplayMode === 'notApplicable' ? 'not-applicable' : value.scoreDisplayMode === 'manual' ? 'manual' : 'informational'; reason = undefined;
      }
      const observed = status !== 'not-checked';
      return {
        id, category, title: short(value?.title, 256) || id, status,
        ...(reason ? { reason } : {}),
        ...(observed ? { description: short(value.description, 2048), found: short(value.explanation || value.displayValue, 2048),
          ...evidence(value.details), textTruncated: ['title', 'description', 'explanation', 'displayValue'].some(key => typeof value[key] === 'string' && value[key].length > (key === 'title' ? 256 : 2048)) } : {}),
        references: [{ title: 'Lighthouse', url: reference + (category === 'performance' ? 'performance/' : category === 'accessibility' ? 'accessibility/' : category === 'seo' ? 'seo/' : 'best-practices/') }]
      };
    });
    return [...checks, ...coverage];
  }
};
