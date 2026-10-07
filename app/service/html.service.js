const cheerio = require('cheerio');
const LinkHeader = require('http-link-header');
const structuredData = require('./structured-data.service');

const maxElements = 5000;
const maxSourceLength = 4096;

module.exports = {
  parse: (page) => {
    const $ = cheerio.load(page.html, { sourceCodeLocationInfo: true });
    const text = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const source = (element, selector) => {
      const html = $.html(element);
      const position = element.sourceCodeLocation;
      const location = position ? {
        startLine: position.startLine, startColumn: position.startCol, endLine: position.endLine,
        endColumn: position.endCol, startOffset: position.startOffset, endOffset: position.endOffset
      } : null;
      return { kind: 'html', selector, location, source: html.slice(0, maxSourceLength), sourceTruncated: html.length > maxSourceLength };
    };
    const resolveUrl = (value, base) => {
      if (typeof value !== 'string' || !value.trim()) return null;
      try {
        const url = new URL(value.trim(), base);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        return url.href;
      } catch { return null; }
    };
    const baseHref = $('head base[href]').first().attr('href');
    const baseUrl = resolveUrl(baseHref, page.finalUrl) || page.finalUrl;
    const metaNodes = $('meta');
    const titleNodes = $('head > title');
    const canonicalNodes = $('head link[rel]').filter((index, element) =>
      ($(element).attr('rel') || '').toLowerCase().split(/\s+/).includes('canonical')
    );
    const headingNodes = $('h1, h2, h3, h4, h5, h6');
    const linkNodes = $('a[href]');
    const imageNodes = $('img');
    const jsonLdNodes = $('script[type]').filter((_index, element) =>
      ($(element).attr('type') || '').split(';')[0].trim().toLowerCase() === 'application/ld+json');
    let jsonBytes = 0;
    const jsonScripts = jsonLdNodes.slice(0, structuredData.limits.maxScripts).toArray().map((element, index) => {
      const content = $(element).text();
      const bytes = Buffer.byteLength(content);
      const contentComplete = bytes <= structuredData.limits.maxScriptBytes && jsonBytes + bytes <= structuredData.limits.maxTotalBytes;
      if (contentComplete) jsonBytes += bytes;
      return {
        index: index + 1, bytes, content: contentComplete ? content : null, contentComplete,
        ...(!contentComplete ? { reason: bytes > structuredData.limits.maxScriptBytes ? 'jsonld-script-size' : 'jsonld-total-size' } : {}),
        ...source(element, 'script[type="application/ld+json"]')
      };
    });
    const limited = (nodes, callback) => nodes.slice(0, maxElements).toArray().map(callback);
    const meta = limited(metaNodes, (element) => ({
      name: ($(element).attr('name') || '').trim().toLowerCase(),
      property: ($(element).attr('property') || '').trim().toLowerCase(),
      content: $(element).attr('content') ?? '',
      ...((($(element).attr('property') || '').trim().toLowerCase().startsWith('og:')) ? { inHead: $(element).parents('head').length > 0 } : {}),
      ...source(element, 'meta')
    }));
    const titles = limited(titleNodes, (element) => ({ value: text($(element).text()), ...source(element, 'head > title') }));
    const descriptions = meta.filter((entry) => entry.name === 'description');
    const openGraphEntries = meta.filter((entry) => entry.property.startsWith('og:'));
    const canonical = limited(canonicalNodes, (element) => ({
      value: $(element).attr('href') ?? '',
      url: resolveUrl($(element).attr('href'), baseUrl),
      parameters: Object.fromEntries(['hreflang', 'lang', 'media', 'type'].filter((name) => $(element).attr(name) !== undefined)
        .map((name) => [name, $(element).attr(name)])),
      ...source(element, 'head link[rel]')
    }));
    let linkHeaderError = false;
    try {
      for (const header of [page.headers?.link || []].flat()) {
        for (const entry of LinkHeader.parse(header).refs) {
          if (!(entry.rel || '').toLowerCase().split(/\s+/).includes('canonical')) continue;
          canonical.push({
            value: entry.uri, url: resolveUrl(entry.uri, page.finalUrl),
            parameters: Object.fromEntries(['hreflang', 'lang', 'media', 'type', 'anchor'].filter((name) => entry[name] !== undefined)
              .map((name) => [name, entry[name]])),
            kind: 'header', name: 'Link', source: header, sourceTruncated: false
          });
        }
      }
    } catch { linkHeaderError = true; }
    const counts = {
      meta: metaNodes.length, titles: titleNodes.length, canonical: canonicalNodes.length + canonical.filter((entry) => entry.kind === 'header').length,
      headings: headingNodes.length, links: linkNodes.length, images: imageNodes.length
    };
    return {
      title: titles[0]?.value || '', titles,
      description: descriptions[0]?.content.trim() || '', descriptions,
      lang: $('html').attr('lang') || '', baseUrl, meta, canonical: canonical.slice(0, maxElements), linkHeaderError, counts,
      jsonLd: {
        count: jsonLdNodes.length, scripts: jsonScripts, bytes: jsonBytes,
        complete: jsonLdNodes.length === jsonScripts.length && jsonScripts.every((entry) => entry.contentComplete)
      },
      openGraph: {
        scope: 'initial-html-sharing-metadata', observedCount: openGraphEntries.length,
        complete: metaNodes.length <= maxElements && openGraphEntries.length <= 100, limit: 100,
        entries: openGraphEntries.slice(0, 100).map((entry) => ({
          ...entry, sourceUrl: page.finalUrl, sourceFormat: 'serialized-html',
          ...(['og:url', 'og:image', 'og:image:url', 'og:image:secure_url', 'og:video', 'og:video:url', 'og:video:secure_url',
            'og:audio', 'og:audio:url', 'og:audio:secure_url'].includes(entry.property) ? { resolvedUrl: resolveUrl(entry.content, baseUrl) } : {})
        }))
      },
      truncated: Object.keys(counts).filter((key) => counts[key] > maxElements),
      headings: limited(headingNodes, (element) => ({
        level: Number(element.tagName.slice(1)), value: text($(element).text()), ...source(element, element.tagName)
      })),
      links: limited(linkNodes, (element) => ({
        href: $(element).attr('href'), url: resolveUrl($(element).attr('href'), baseUrl),
        text: text($(element).text()), rel: ($(element).attr('rel') || '').toLowerCase().split(/\s+/).filter(Boolean),
        ...source(element, 'a[href]')
      })),
      images: limited(imageNodes, (element) => ({
        src: $(element).attr('src') || '', url: resolveUrl($(element).attr('src'), baseUrl),
        alt: $(element).attr('alt') ?? null, hasAlt: $(element).attr('alt') !== undefined,
        ...source(element, 'img')
      }))
    };
  }
};
