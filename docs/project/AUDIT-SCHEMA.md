# Audit Check Contract

The report schema is versioned by `schemaVersion`. Each page contains `checks`;
`issues` contains only checks with a fail or review outcome, never every check.

Every check includes:

- `ruleId`, `ruleVersion`, and `id`: stable rule identity for comparison and export.
- `url` and `urls`: the audited page, not a guessed repository filename.
- `category`, `title`, `found`, `impact`, and `steps`: Thai factual findings and
  actions. Owner confirmation is explicit when intent cannot be inferred.
- `evidence`: actual markup, response facts, robots matching lines, or observations
  describing the scope of an absence check. `sourceUrl` locates the source document.
  A canonical/image entry's `url` is its resolved target, not the source document.
- `references`: labeled HTTPS links to primary Google or W3C documentation.

HTML snippets are serialized by the HTML parser, not byte-for-byte excerpts.
`sourceFormat: serialized-html` identifies this. HTML `location` is reported by
parse5 against the decoded, fetched HTML: 1-based start/end lines and columns,
0-based JavaScript string offsets with an exclusive end. Positions are not measured
in the serialized snippet or inferred from repository files. Implicit nodes have
no location. `sourceTruncated` marks shortened snippets. Absence observations contain selectors
and counts, never invented replacement markup. Robots line numbers are 1-based
positions in the fetched robots.txt. Filesystem paths are not inferred from URLs.
The detail panel displays document URLs, locations, header names and robots lines.
At most 50 evidence entries are previewed; copying or CSV includes the full evidence
returned by the API, including any disclosed parser truncation.

Passing one rule is not a ranking score, an indexing confirmation, or proof that
the entire website passed. JavaScript-rendered content has not been examined yet.

## Outcomes and Coverage

- `pass`: this rule found no defect within the observed scope, not an SEO guarantee.
- `fail`: a concrete defect was found, with separate severity (critical or warning).
- `review`: the evidence requires context or owner intent, such as deliberate noindex.
- `not-checked`: unavailable evidence or a limit prevents checking this rule.

`complete: false` can accompany a fail/review when evidence proves a finding but
not all elements were examined. `notChecked` then discloses the missing coverage.
`summary.checks` counts outcomes; severity counters count only actual issues.
`analysisStatus: complete` on a page refers to the implemented initial-page rules.
Report status remains partial while renderer, Lighthouse or broader site analysis
has not been performed. `notChecked` names those unavailable surfaces explicitly.

## URL Discovery

Opt-in discovery adds `discovery.urls`, sitemap evidence and bounded skipped records.
Each candidate has `url` and `sources` (link selector/HTML position or sitemap
source URL/entry index). URL fragments are removed; meaningful query values remain.
`coverage.discovered` counts candidates, while fetched/analyzed counts still include
only actually examined pages. Discovery never substitutes HTTP results for an
unfetched URL. Scope is `same-origin-discovery` and currently analyzes one page.
