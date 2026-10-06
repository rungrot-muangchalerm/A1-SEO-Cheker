const website = require('../data/website.data');
const agentic = require('./agentic.service');
const labels = { performance: 'Performance', accessibility: 'Accessibility', 'best-practices': 'Best Practices', seo: 'SEO' };
const text = (value, max = 256) => typeof value === 'string' && value.length <= max ? value : undefined;

module.exports = {
  format: (response, value, options = {}) => {
    const base = { provider: 'lighthouse-local', url: value, strategy: ['mobile', 'desktop'].includes(options.strategy) ? options.strategy : 'mobile',
      scope: { type: 'single-url', url: value }, startedAt: options.startedAt || new Date().toISOString(), categories: [],
      agentic: { status: 'not-checked', reason: 'provider-result-unavailable' } };
    const completedAt = new Date().toISOString();
    if (response.status !== 'received') return { ...base, ...response, completedAt };
    const lhr = response.data?.lighthouseResult;
    const prefix = 'LIGHTHOUSE';
    if (!lhr || typeof lhr !== 'object' || lhr.runtimeError || response.data?.error) return { ...base, completedAt,
      status: 'not-checked', reason: prefix + (lhr?.runtimeError ? '_RUNTIME' : '_INVALID_RESPONSE') };
    let requestedUrl, finalUrl;
    try {
      requestedUrl = website.parseUrl(lhr.requestedUrl, options).href;
      finalUrl = website.parseUrl(lhr.finalUrl, options).href;
      if (requestedUrl !== website.parseUrl(value, options).href) throw new Error('URL mismatch');
      if (options.localOrigin && new URL(finalUrl).origin !== options.localOrigin) throw new Error('Origin mismatch');
    } catch { return { ...base, completedAt, status: 'not-checked', reason: prefix + '_INVALID_RESPONSE' }; }
    const categories = Object.keys(labels).map((id) => {
      const score = lhr.categories?.[id]?.score;
      const valid = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1;
      return { id, title: labels[id], status: valid ? 'completed' : 'not-checked', score: valid ? score : null,
        ...(valid ? { displayScore: Math.round(score * 100) } : { reason: prefix + '_SCORE_UNAVAILABLE' }) };
    });
    const formFactor = text(lhr.configSettings?.formFactor || lhr.configSettings?.emulatedFormFactor);
    if (['mobile', 'desktop'].includes(formFactor) && formFactor !== base.strategy) return { ...base, completedAt,
      status: 'not-checked', reason: prefix + '_MODE_MISMATCH' };
    const result = { ...base, completedAt, status: categories.every((entry) => entry.status === 'completed') ? 'completed' : 'partial',
      requestedUrl, finalUrl, categories, agentic: agentic.analyze(lhr), fetchTime: text(lhr.fetchTime) && Number.isFinite(Date.parse(lhr.fetchTime)) ? lhr.fetchTime : undefined,
      engine: { name: 'Lighthouse', version: text(lhr.lighthouseVersion), userAgent: text(lhr.environment?.hostUserAgent || lhr.userAgent, 1024) },
      mode: { formFactor, throttlingMethod: text(lhr.configSettings?.throttlingMethod) }, warningCount: Array.isArray(lhr.runWarnings) ? lhr.runWarnings.length : 0 };
    return result;
  }
};
