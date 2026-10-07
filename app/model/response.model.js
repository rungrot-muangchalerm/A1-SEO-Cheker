const website = require('../data/website.data');

module.exports = {
  createIndex: (responses = [], options = {}) => {
    const entries = new Map();
    for (const response of responses) {
      for (const value of [response.requestedUrl, response.url, ...(response.redirects || []).map((hop) => hop.url)]) {
        if (!value) continue;
        const key = website.parseUrl(value, options).href;
        if (!entries.has(key) || response.terminal && !entries.get(key).terminal) entries.set(key, response);
      }
    }
    return {
      get: (value) => {
        let url;
        try { url = website.parseUrl(value, options).href; } catch { return { available: false, reason: 'invalid-url' }; }
        const visited = new Set();
        const redirects = [];
        let last;
        for (; ;) {
          if (visited.has(url)) return { available: false, reason: 'REDIRECT_LOOP', observation: last, redirects };
          visited.add(url);
          const response = entries.get(url);
          if (!response) return { available: false, reason: last?.fetchError || 'not-fetched', observation: last, redirects };
          if (response.fetchError === 'REDIRECT_LOOP') return {
            available: false, reason: 'REDIRECT_LOOP',
            observation: response, redirects: response.redirects || [], reusedResponse: !!last
          };
          const start = (response.redirects || []).findIndex((hop) => website.parseUrl(hop.url, options).href === url);
          if (start >= 0) redirects.push(...response.redirects.slice(start));
          if (response.terminal) return { available: true, ...response, redirects, reusedResponse: !!last };
          last = response;
          const destination = redirects.at(-1)?.destination;
          if (!destination) return { available: false, reason: response.fetchError || 'redirect-unresolved', observation: response, redirects };
          try { url = website.parseUrl(destination, options).href; }
          catch { return { available: false, reason: response.fetchError || 'invalid-redirect', observation: response, redirects }; }
        }
      }
    };
  }
};
