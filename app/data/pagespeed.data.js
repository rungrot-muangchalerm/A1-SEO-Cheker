const website = require('./website.data');

const limits = Object.freeze({ timeoutMs: 90000, maxBytes: 8 * 1024 * 1024 });
const categories = Object.freeze(['performance', 'accessibility', 'best-practices', 'seo']);

module.exports = {
  limits, categories,
  run: async (value, options = {}) => {
    const controller = new AbortController();
    const cancel = () => controller.abort(new website.WebsiteError('CANCELLED'));
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new website.WebsiteError('PAGESPEED_TIMEOUT')), Math.min(options.timeoutMs || limits.timeoutMs, limits.timeoutMs));
    try {
      controller.signal.throwIfAborted();
      const target = website.parseUrl(value);
      const strategy = options.strategy === undefined ? 'mobile' : options.strategy;
      if (!['mobile', 'desktop'].includes(strategy)) return { status: 'not-checked', reason: 'PAGESPEED_INVALID_STRATEGY' };
      const key = (process.env.PAGESPEED_API_KEY || '').trim();
      if (!key) return { status: 'not-checked', reason: 'not-configured' };
      await website.resolvePublicTarget(target, controller.signal);
      const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
      endpoint.searchParams.set('url', target.href);
      endpoint.searchParams.set('key', key);
      endpoint.searchParams.set('strategy', strategy);
      categories.forEach((category) => endpoint.searchParams.append('category', category));
      const addresses = await website.resolvePublicTarget(endpoint, controller.signal);
      controller.signal.throwIfAborted();
      const response = await website.requestPage(endpoint, addresses, controller.signal, limits.maxBytes, 'json');
      if (response.redirect) return { status: 'not-checked', reason: 'PAGESPEED_REDIRECT' };
      if (response.status !== 200) return { status: 'not-checked', reason: response.status === 429 ? 'PAGESPEED_QUOTA' :
        [401, 403].includes(response.status) ? 'PAGESPEED_AUTH' : 'PAGESPEED_HTTP', httpStatus: response.status };
      let data;
      try { data = JSON.parse(response.text); } catch { return { status: 'not-checked', reason: 'PAGESPEED_INVALID_RESPONSE' }; }
      return { status: 'received', data };
    } catch (error) {
      if (options.signal?.aborted) throw new website.WebsiteError('CANCELLED');
      return { status: 'not-checked', reason: controller.signal.aborted ? 'PAGESPEED_TIMEOUT' :
        error instanceof website.WebsiteError ? error.code : 'PAGESPEED_NETWORK' };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
};
