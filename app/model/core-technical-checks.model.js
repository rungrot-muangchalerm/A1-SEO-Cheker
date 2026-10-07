const siteFilesService = require('../service/site-files.service');
const definitions = [
  ['http-status', 'HTTP status'], ['robots-crawling', 'Googlebot crawl access'],
  ['robots-indexing', 'Meta robots / X-Robots-Tag'], ['robots-following', 'Nofollow'],
  ['title-content', 'Title'], ['description-content', 'Meta description'],
  ['canonical-declaration', 'Canonical declaration'], ['canonical-target', 'Canonical target'],
  ['duplicate-title', 'Duplicate titles'], ['duplicate-description', 'Duplicate descriptions'],
  ['internal-link-target', 'Internal link targets', 'internal-link-coverage'],
  ['sitemap-url-target', 'Sitemap URL targets', 'sitemap-url-coverage', 'sitemap-restricted-loc'],
  ['image-alt', 'Image alt'], ['open-graph', 'Open Graph'],
  ['jsonld-syntax', 'JSON-LD syntax', 'jsonld-extraction']
];
const agenticDefinitions = [
  ['agent-accessibility-tree', 'Agent accessibility tree', 'Review the observed node evidence; use semantic elements, accessible names and valid ARIA relationships.'],
  ['cumulative-layout-shift', 'Layout stability (CLS)', 'Reserve space for media and dynamic content; review the layout shifts observed on this URL.'],
  ['llms-txt', 'llms.txt', 'Check the observed response and Markdown format of /llms.txt, including a heading and useful links.'],
  ['ard-schema', 'AI resource catalog', 'Review the declared AI catalog URL, its response and schema using the engine evidence.'],
  ['webmcp-registered-tools', 'WebMCP tools', 'Review WebMCP tool registration on this URL when agent integration is intended.'],
  ['webmcp-schema-validity', 'WebMCP schema', 'Fix the tool schema identified in the engine evidence and run the audit again.'],
  ['webmcp-form-coverage', 'WebMCP forms', 'Review the observed forms and their declarative WebMCP integration when intended.']
];
const statusLabels = {
  pass: '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32', fail: '\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32',
  review: '\u0e15\u0e49\u0e2d\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19', 'not-checked': '\u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49',
  'not-applicable': '\u0e44\u0e21\u0e48\u0e40\u0e02\u0e49\u0e32\u0e40\u0e07\u0e37\u0e48\u0e2d\u0e19\u0e44\u0e02',
  manual: '\u0e15\u0e49\u0e2d\u0e07\u0e15\u0e23\u0e27\u0e08\u0e40\u0e2d\u0e07', informational: '\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a',
  found: '\u0e1e\u0e1a\u0e44\u0e1f\u0e25\u0e4c', missing: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e1a', invalid: '\u0e23\u0e39\u0e1b\u0e41\u0e1a\u0e1a\u0e15\u0e49\u0e2d\u0e07\u0e15\u0e23\u0e27\u0e08', unavailable: '\u0e22\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49'
};
const entry = value => ({ ...value, statusLabel: statusLabels[value.status] });

module.exports = {
  analyze: ({ page, pages, checks, siteFiles, lighthouse }) => {
    const files = siteFiles.length ? siteFiles : siteFilesService.analyze(page);
    const results = files.map(file => entry({
      id: file.id, title: file.label, group: 'site-files', scope: file.scope, status: file.status,
      complete: ['found', 'missing', 'invalid'].includes(file.status), found: file.found,
      recommendation: file.recommendation, steps: file.steps, evidence: file.evidence, evidenceOmitted: file.evidenceOmitted,
      references: file.references, ...(file.reason ? { reason: file.reason } : {})
    }));
    for (const [id, title, ...related] of definitions) {
      const matches = checks.filter(check => [id, ...related].includes(check.ruleId));
      const counts = { pass: 0, fail: 0, review: 0, notChecked: 0 };
      for (const match of matches) ++counts[match.outcome === 'not-checked' ? 'notChecked' : match.outcome];
      const complete = matches.length > 0 && matches.every(check => check.complete !== false && check.outcome !== 'not-checked');
      const status = counts.fail ? 'fail' : counts.review ? 'review' : !complete ? 'not-checked' : 'pass';
      const issues = matches.filter(check => ['fail', 'review'].includes(check.outcome));
      const first = issues.find(check => check.outcome === status) || matches.find(check => check.outcome === 'not-checked' || check.complete === false);
      const noJsonLd = id === 'jsonld-syntax' && !matches.length && pages.length > 0 &&
        pages.every(page => page.metadata?.jsonLd?.count === 0 && page.metadata.jsonLd.complete);
      results.push(entry({
        id, title, group: 'technical-seo', scope: 'observed-pages-and-targets', status: noJsonLd ? 'not-applicable' : status,
        complete: noJsonLd || complete, counts, issueIds: issues.map(check => check.id),
        checkIds: matches.map(check => check.id),
        found: noJsonLd ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a JSON-LD \u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48\u0e2d\u0e48\u0e32\u0e19\u0e44\u0e14\u0e49' : first?.found || (matches.length ?
          '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1b\u0e31\u0e0d\u0e2b\u0e32\u0e43\u0e19 ' + matches.length + ' \u0e1c\u0e25\u0e15\u0e23\u0e27\u0e08' : '\u0e23\u0e2d\u0e1a\u0e19\u0e35\u0e49\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1c\u0e25\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e02\u0e49\u0e2d\u0e19\u0e35\u0e49'),
        steps: first?.steps || [], ...(first?.reason || !matches.length && !noJsonLd ? { reason: first?.reason || 'not-requested-or-not-applicable' } : {})
      }));
    }
    const rendered = pages.filter(page => page.render?.after);
    const staticPages = pages.filter(page => page.render?.reason === 'no-executable-script');
    const renderComplete = pages.length > 0 && pages.every(page => page.render?.status === 'completed' || page.render?.reason === 'no-executable-script');
    results.push(entry({ id: 'javascript-render', title: 'JavaScript metadata', group: 'technical-seo', scope: 'selected-pages',
      status: renderComplete ? (staticPages.length === pages.length ? 'not-applicable' : 'pass') : 'not-checked', complete: renderComplete,
      found: '\u0e23\u0e31\u0e19 JavaScript ' + rendered.length + ' \u0e2b\u0e19\u0e49\u0e32; \u0e44\u0e21\u0e48\u0e21\u0e35 executable script ' + staticPages.length + ' \u0e2b\u0e19\u0e49\u0e32; \u0e2d\u0e48\u0e32\u0e19 HTML ' + pages.length + ' \u0e2b\u0e19\u0e49\u0e32',
      steps: [], ...(renderComplete ? {} : { reason: pages.find(page => page.render?.status !== 'completed' && page.render?.reason !== 'no-executable-script')?.render?.reason || 'render-incomplete-or-not-requested' }) }));
    const technical = lighthouse?.technicalChecks || ['is-on-https', 'html-has-lang', 'heading-order', 'viewport-insight'].map(id => ({
      id, title: id, category: id === 'viewport-insight' ? 'performance' : id === 'is-on-https' ? 'best-practices' : 'accessibility',
      status: 'not-checked', reason: lighthouse?.reason || 'provider-result-unavailable'
    }));
    for (const check of technical) results.push(entry({
      id: 'lighthouse:' + check.id, title: check.title, group: 'lighthouse-' + check.category, scope: 'single-url',
      url: lighthouse?.finalUrl || lighthouse?.url || page.finalUrl, status: check.status,
      complete: !['not-checked', 'manual'].includes(check.status) && !check.evidenceTruncated && !check.textTruncated,
      found: check.found || check.description || check.title,
      steps: ['fail', 'manual'].includes(check.status) && check.description ? [check.description] : [],
      evidence: check.evidence || [], evidenceTruncated: !!check.evidenceTruncated, textTruncated: !!check.textTruncated,
      references: check.references || [], ...(check.reason ? { reason: check.reason } : {})
    }));
    const agentic = lighthouse?.agentic;
    for (const [id, title, step] of agenticDefinitions) {
      const audit = agentic?.audits?.find(audit => audit.id === id);
      results.push(entry({ id: 'agentic:' + id, title: audit?.title || title, group: 'agentic', scope: 'single-url',
        url: lighthouse?.finalUrl || lighthouse?.url || page.finalUrl, status: audit?.status || 'not-checked',
        complete: !!audit && !['not-checked', 'manual'].includes(audit.status) && !audit.truncated,
        found: audit?.explanation || audit?.displayValue || audit?.description || '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1c\u0e25 Agentic \u0e23\u0e32\u0e22\u0e02\u0e49\u0e2d\u0e08\u0e32\u0e01 engine',
        steps: ['fail', 'manual'].includes(audit?.status) ? [step] : [], evidence: audit?.evidence || [],
        ...(['llms-txt', 'ard-schema'].includes(id) && audit?.status === 'not-applicable' ? {
          recommendation: 'Optional agent-discovery resource: consider adding it when useful for your site. Engine N/A alone does not establish a missing file; confirm the HTTP response before changing routes.'
        } : {}),
        ...(audit?.reason || !audit ? { reason: audit?.reason || agentic?.reason || lighthouse?.reason || 'not-requested' } : {}),
        references: [{ title: 'Lighthouse Agentic Browsing', url: 'https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring' }]
      }));
    }
    results.push(entry({ id: 'jsonld-semantics', title: 'Structured data semantics / rich results', group: 'technical-seo',
      scope: 'outside-scope', status: 'not-checked', complete: false, reason: 'not-implemented',
      found: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 schema type, \u0e04\u0e27\u0e32\u0e21\u0e2b\u0e21\u0e32\u0e22 \u0e2b\u0e23\u0e37\u0e2d\u0e04\u0e38\u0e13\u0e2a\u0e21\u0e1a\u0e31\u0e15\u0e34 rich results',
      steps: [], references: [{ title: 'Google Search Central', url: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data' }] }));
    return results;
  }
};
