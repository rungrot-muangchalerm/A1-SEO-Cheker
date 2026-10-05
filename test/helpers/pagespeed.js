const base = 'https://site.example/';
const lhr = (changes = {}) => ({ requestedUrl: base, finalUrl: base + 'final', lighthouseVersion: '13.4.0',
  fetchTime: '2026-10-06T01:00:00.000Z', userAgent: 'HeadlessChrome/153.0.8010.12',
  configSettings: { formFactor: 'mobile', throttlingMethod: 'simulate' },
  categories: Object.fromEntries(['performance', 'accessibility', 'best-practices', 'seo'].map((id, index) => [id, { id, score: [0.72, 0.91, 1, 0][index] }])),
  ...changes });
const jsonResponse = (result = lhr()) => ({ html: JSON.stringify({ lighthouseResult: result }), headers: { 'content-type': 'application/json' } });
const key = (t, value = 'SERVER_ONLY_TEST_KEY') => {
  const old = process.env.PAGESPEED_API_KEY;
  process.env.PAGESPEED_API_KEY = value;
  t.after(() => { if (old === undefined) delete process.env.PAGESPEED_API_KEY; else process.env.PAGESPEED_API_KEY = old; });
};
module.exports = { base, lhr, jsonResponse, key };
