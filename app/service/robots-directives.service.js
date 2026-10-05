const valueDirectives = new Set([
  'max-snippet', 'max-image-preview', 'max-video-preview', 'unavailable_after'
]);

function parseValues(content) {
  return content.toLowerCase().split(',').flatMap((part) => {
    const value = part.trim();
    if (!value) return [];
    if (/^[a-z][a-z0-9_-]*\s*:/.test(value)) return [value.replace(/\s*:\s*/, ':')];
    return value.split(/\s+/);
  });
}

module.exports = {
  read: (page) => {
    const entries = [];
    for (const meta of page.metadata.meta) {
      if (!['robots', 'googlebot', 'googlebot-news'].includes(meta.name)) continue;
      entries.push({
        agent: meta.name === 'robots' ? '*' : meta.name,
        values: parseValues(meta.content),
        evidence: { kind: 'html', ...meta }
      });
    }
    const raw = page.rawHeaders || [];
    const headers = [];
    for (let index = 0; index < raw.length; index += 2) {
      if (raw[index].toLowerCase() === 'x-robots-tag') headers.push(raw[index + 1]);
    }
    if (!headers.length && page.headers['x-robots-tag']) {
      headers.push(...[page.headers['x-robots-tag']].flat());
    }
    for (const header of headers) {
      let agent = '*';
      // A joined header can change agent scope; value directives also contain colons.
      for (const part of header.toLowerCase().split(',')) {
        let value = part.trim();
        const prefix = /^([a-z0-9_*.-]+)\s*:\s*(.*)$/.exec(value);
        if (prefix && !valueDirectives.has(prefix[1])) {
          agent = prefix[1];
          value = prefix[2];
        }
        if (!value) continue;
        entries.push({
          agent, values: parseValues(value),
          evidence: { kind: 'header', name: 'X-Robots-Tag', source: header }
        });
      }
    }
    const applicable = entries.filter((entry) => ['*', 'googlebot'].includes(entry.agent));
    const values = new Set(applicable.flatMap((entry) => entry.values));
    return {
      entries, applicable,
      noindex: values.has('noindex') || values.has('none'),
      nofollow: values.has('nofollow') || values.has('none'),
      hasExpiration: applicable.some((entry) => entry.values.some((value) => value.startsWith('unavailable_after:'))),
      indexifembedded: values.has('indexifembedded'),
      truncated: page.metadata.truncated.includes('meta')
    };
  }
};
