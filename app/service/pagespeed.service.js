const provider = require('../data/pagespeed.data');
const website = require('../data/website.data');
const labels = { performance: 'Performance', accessibility: 'Accessibility', 'best-practices': 'Best Practices', seo: 'SEO' };
const text = (value, max = 256) => typeof value === 'string' && value.length <= max ? value : undefined;

module.exports = {
  run: async (value, options = {}) => {
    const base = { provider: 'pagespeed-insights', url: value, strategy: 'mobile', startedAt: new Date().toISOString(), categories: [] };
    const response = await provider.run(value, options);
    const completedAt = new Date().toISOString();
    if (response.status !== 'received') return { ...base, ...response, completedAt };
    const lhr = response.data?.lighthouseResult;
    if (!lhr || typeof lhr !== 'object' || lhr.runtimeError || response.data?.error) return { ...base, completedAt,
      status: 'not-checked', reason: lhr?.runtimeError ? 'PAGESPEED_RUNTIME' : 'PAGESPEED_INVALID_RESPONSE' };
    let requestedUrl, finalUrl;
    try {
      requestedUrl = website.parseUrl(lhr.requestedUrl).href;
      finalUrl = website.parseUrl(lhr.finalUrl).href;
      if (requestedUrl !== website.parseUrl(value).href) throw new Error('URL mismatch');
    } catch { return { ...base, completedAt, status: 'not-checked', reason: 'PAGESPEED_INVALID_RESPONSE' }; }
    const categories = provider.categories.map((id) => {
      const score = lhr.categories?.[id]?.score;
      const valid = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1;
      return { id, title: labels[id], status: valid ? 'completed' : 'not-checked', score: valid ? score : null,
        ...(valid ? { displayScore: Math.round(score * 100) } : { reason: 'PAGESPEED_SCORE_UNAVAILABLE' }) };
    });
    const result = { ...base, completedAt, status: categories.every((entry) => entry.status === 'completed') ? 'completed' : 'partial',
      requestedUrl, finalUrl, categories, fetchTime: text(lhr.fetchTime), engine: { name: 'Lighthouse', version: text(lhr.lighthouseVersion),
        userAgent: text(lhr.environment?.hostUserAgent || lhr.userAgent, 1024) },
      mode: { formFactor: text(lhr.configSettings?.formFactor || lhr.configSettings?.emulatedFormFactor),
        throttlingMethod: text(lhr.configSettings?.throttlingMethod) }, warningCount: Array.isArray(lhr.runWarnings) ? lhr.runWarnings.length : 0 };
    // Only allowlisted facts leave the provider boundary; never relay raw errors, screenshots or keys.
    const key = (process.env.PAGESPEED_API_KEY || '').trim();
    if (key && JSON.stringify(result).includes(key)) return { ...base, completedAt, status: 'not-checked', reason: 'PAGESPEED_INVALID_RESPONSE' };
    return result;
  }
};
