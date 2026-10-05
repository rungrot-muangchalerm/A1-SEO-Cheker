const cheerio = require('cheerio');

const maxElements = 5000;
const maxSourceLength = 4096;

module.exports = {
  parse: (page) => {
    const $ = cheerio.load(page.html);
    const text = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const source = (element, selector) => {
      const html = $.html(element);
      return { selector, source: html.slice(0, maxSourceLength), sourceTruncated: html.length > maxSourceLength };
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
    const limited = (nodes, callback) => nodes.slice(0, maxElements).toArray().map(callback);
    const meta = limited(metaNodes, (element) => ({
      name: ($(element).attr('name') || '').trim().toLowerCase(),
      property: ($(element).attr('property') || '').trim().toLowerCase(),
      content: $(element).attr('content') ?? '',
      ...source(element, 'meta')
    }));
    const titles = limited(titleNodes, (element) => ({ value: text($(element).text()), ...source(element, 'head > title') }));
    const descriptions = meta.filter((entry) => entry.name === 'description');
    const canonical = limited(canonicalNodes, (element) => ({
      value: $(element).attr('href') ?? '',
      url: resolveUrl($(element).attr('href'), baseUrl),
      ...source(element, 'head link[rel]')
    }));
    const counts = {
      meta: metaNodes.length, titles: titleNodes.length, canonical: canonicalNodes.length,
      headings: headingNodes.length, links: linkNodes.length, images: imageNodes.length
    };
    return {
      title: titles[0]?.value || '', titles,
      description: descriptions[0]?.content.trim() || '', descriptions,
      lang: $('html').attr('lang') || '', baseUrl, meta, canonical, counts,
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
