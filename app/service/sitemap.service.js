const { XMLParser, XMLValidator } = require('fast-xml-parser');
const website = require('../data/website.data');

const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';

function element(node, inherited = {}) {
  const name = Object.keys(node).find((key) => key !== ':@');
  if (!name || name.startsWith('#') || name.startsWith('?')) return null;
  const bindings = Object.assign(Object.create(null), inherited);
  for (const [key, value] of Object.entries(node[':@'] || {})) {
    if (key === '@_xmlns') bindings[''] = value;
    else if (key.startsWith('@_xmlns:')) bindings[key.slice('@_xmlns:'.length)] = value;
  }
  const parts = name.split(':');
  const prefix = parts.length > 1 ? parts[0] : '';
  return { name: parts.at(-1), namespace: bindings[prefix] ?? (prefix ? null : ''), bindings, children: node[name] };
}

module.exports = {
  parse: (xml) => {
    if (typeof xml !== 'string' || Buffer.byteLength(xml) > 512 * 1024) throw new website.WebsiteError('SITEMAP_TOO_LARGE');
    // Reject DTD markers before entity processing; sitemap data never needs a DTD.
    if (/<!DOCTYPE\b/i.test(xml)) throw new website.WebsiteError('SITEMAP_DTD_UNSUPPORTED');
    if (XMLValidator.validate(xml) !== true) throw new website.WebsiteError('SITEMAP_INVALID_XML');
    let tree;
    try {
      tree = new XMLParser({
        preserveOrder: true, ignoreAttributes: false, ignoreDeclaration: true, ignorePiTags: true,
        parseTagValue: false, parseAttributeValue: false, maxNestedTags: 20,
        processEntities: { enabled: true, maxEntityCount: 1, maxEntitySize: 8192, maxExpansionDepth: 2,
          maxExpandedLength: 512 * 1024, maxTotalExpansions: 50000 }
      }).parse(xml);
    } catch { throw new website.WebsiteError('SITEMAP_INVALID_XML'); }
    const roots = tree.map((node) => element(node)).filter(Boolean);
    const root = roots[0];
    if (roots.length !== 1 || !['urlset', 'sitemapindex'].includes(root.name) ||
        ![namespace, ''].includes(root.namespace)) throw new website.WebsiteError('SITEMAP_INVALID_ROOT');
    const tag = root.name === 'urlset' ? 'url' : 'sitemap';
    const nodes = root.children.map((node) => element(node, root.bindings)).filter((node) => node?.name === tag && node.namespace === root.namespace);
    const entries = nodes.slice(0, 1000).map((node, index) => {
      const locations = node.children.map((child) => element(child, node.bindings)).filter((child) => child?.name === 'loc' && child.namespace === root.namespace);
      const loc = locations[0];
      const textOnly = loc && loc.children.every((child) => Object.hasOwn(child, '#text'));
      const value = textOnly ? loc.children.map((child) => child['#text']).join('').trim() : '';
      let url = null;
      try { if (textOnly && locations.length === 1) url = website.parseUrl(value).href; } catch {}
      return { value, url, kind: 'sitemap', selector: root.name + ' > ' + tag + ' > loc', entryIndex: index + 1 };
    });
    return { type: root.name, namespaceVerified: root.namespace === namespace, entries,
      totalEntries: nodes.length, truncated: nodes.length > entries.length };
  }
};
