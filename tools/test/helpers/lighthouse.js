const base = 'https://site.example/';
const lhr = (changes = {}) => ({ requestedUrl: base, finalUrl: base + 'final', lighthouseVersion: '13.4.0',
  fetchTime: '2026-10-06T01:00:00.000Z', userAgent: 'HeadlessChrome/153.0.8010.12',
  configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate' },
  categories: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map((id, index) => [id, { id, score: [0.72, 0.91, 1, 0][index] }])),
  ...changes });
const stubLighthouse = (t, sources = [lhr()]) => {
  const calls = [];
  t.mock.method(require('../../../app/service/lighthouse.service'), 'run', async (url, options) => {
    calls.push({ url, strategy: options.strategy });
    const source = sources.shift();
    if (!source) throw new Error('Unexpected Lighthouse fixture request');
    const response = source.status === 'not-checked' ? source : { status: 'received', data: { lighthouseResult: source } };
    return require('../../../app/service/lighthouse-result.service').format(response, url, options);
  });
  return { calls };
};
module.exports = { base, lhr, stubLighthouse };
