function pick(value, keys) {
  return Object.fromEntries(keys.filter(key => value && Object.hasOwn(value, key)).map(key => [key, value[key]]));
}

function redirects(entries = []) {
  return entries.map(entry => pick(entry, ['url', 'status', 'destination']));
}

function metadata(value) {
  return {
    ...pick(value, ['title', 'description', 'lang', 'baseUrl', 'linkHeaderError', 'truncated']),
    counts: pick(value.counts, ['meta', 'titles', 'canonical', 'headings', 'links', 'images']),
    canonical: (value.canonical || []).map(entry => pick(entry, ['value', 'url', 'parameters', 'kind'])),
    headings: (value.headings || []).map(entry => pick(entry, ['level', 'value'])),
    ...(value.jsonLd ? { jsonLd: pick(value.jsonLd, ['count', 'complete']) } : {}),
    ...(value.openGraph ? { openGraph: {
      ...pick(value.openGraph, ['scope', 'observedCount', 'complete', 'limit']),
      entries: value.openGraph.entries.map(entry => pick(entry, ['property', 'content', 'inHead', 'resolvedUrl']))
    } } : {})
  };
}

function comparison(value) {
  return {
    ...pick(value, ['title', 'description', 'canonical', 'h1', 'metadataComplete', 'documentUrl', 'sourceFormat']),
    text: pick(value.text, ['length'])
  };
}

function render(value) {
  return {
    ...pick(value, ['url', 'status', 'reason', 'complete', 'mode', 'startedAt', 'completedAt', 'limits', 'stats', 'changes', 'limitations', 'indexing']),
    ...(value.engine ? { engine: pick(value.engine, ['name', 'version', 'playwright']) } : {}),
    ...(value.before ? { before: comparison(value.before) } : {}),
    ...(value.after ? { after: comparison(value.after) } : {}),
    ...(value.resources ? { resources: {
      ...pick(value.resources, ['omitted', 'scriptErrors', 'consoleErrors']),
      records: value.resources.records.map(entry => pick(entry, ['url', 'status', 'bytes', 'destination', 'reason']))
    } } : {})
  };
}

module.exports = {
  // Only public result fields cross the API boundary; source documents stay in the audit pipeline.
  page: (value, checks) => ({
    ...pick(value, ['requestedUrl', 'finalUrl', 'status', 'bytes']),
    redirects: redirects(value.redirects),
    fetchStatus: 'success',
    analysisStatus: !checks.length ? 'not-checked' :
      checks.some(entry => entry.outcome === 'not-checked' || entry.complete === false) ? 'partial' : 'complete',
    ...(value.metadata ? { metadata: metadata(value.metadata) } : {}),
    ...(value.robots ? { robots: pick(value.robots, ['url', 'status', 'reason', 'httpStatus', 'googlebotAllowed', 'crawlerAllowed']) } : {}),
    ...(value.render ? { render: render(value.render) } : {}),
    checks
  }),
  discovery: (value) => ({
    ...pick(value, ['origin', 'urls', 'skipped', 'skippedOmitted', 'limitReached', 'linkExtractionComplete', 'limits']),
    sitemaps: (value.sitemaps || []).map(entry => ({
      ...pick(entry, ['url', 'finalUrl', 'httpStatus', 'bytes', 'contentType', 'sourceUrl', 'entryIndex', 'status', 'reason', 'type', 'namespaceVerified', 'totalEntries', 'truncated']),
      redirects: redirects(entry.redirects)
    }))
  }),
  response: (value) => ({
    ...pick(value, ['requestedUrl', 'url', 'status', 'terminal', 'fetchError']),
    redirects: redirects(value.redirects)
  })
};
