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
Sitemap records retain requested/final file URLs, HTTP status, redirects, parsed
entries, namespace verification and truncation. Index children also record their
parent `sourceUrl` and entry index. File/entry/deadline limits mean incomplete
discovery, not a complete site audit; skipped reasons and `notChecked` disclose it.

## Bounded Crawl

`crawl: true` uses scope `same-origin-crawl`. `pages` contains only fetched HTML,
including real 4xx/5xx HTML responses; failed fetches are in `coverage.skipped` with
a reason and no guessed HTTP code. `discovery.urls` grows as later pages yield links.
`coverage.fetched/analyzed` and `summary.pages` count actual page records, not candidates.
Each multi-page check ID includes its rule ID and document URL so detail buttons
cannot select another page's instance. Outcome/severity summaries aggregate actual
checks; `affected` counts unique affected document URLs.

`siteChecks` contains checks that compare multiple pages and participates in the
same issue/severity/outcome summaries. Duplicate title/description groups use a
rule ID plus SHA-256 of the whitespace-normalized, case-sensitive full value;
all matching document URLs and individual parsed source locations are retained.
Group findings are review, since intentional duplicates/noindex/canonical policy
cannot be inferred from identical text alone. `details` records examined/eligible
pages, excluded URLs/reasons, the comparison scope and a bounded value preview/hash.
Empty declarations and non-2xx templates are excluded. Ambiguous or truncated
metadata leaves incomplete coverage; fewer than two eligible pages is not checked.
An absence claim applies only to eligible fetched pages, never undiscovered pages.

`responses` records HTTP headers/status and redirect hops actually observed during
the crawl, including non-HTML responses rejected by the HTML analyzer. It contains
no response bodies for those rejected resources. `terminal: false` means the last
observed response was a redirect whose destination was not read; its status is not
presented as the destination's status. `fetchError` preserves the refusal/failure.
These records exist only in the current request/report, not a server-side cache.

`internal-link-target` groups an unavailable/broken destination with all source
page URLs and parsed href evidence. `details.httpStatus` is the actual terminal
status or null; `lastHttpStatus` may be the last observed redirect. A real redirect
loop is reported with its observed chain, never an invented final HTTP code.
401/403/429 and unresolved terminal 3xx require review; other observed 4xx/5xx
are findings. A successful non-HTML response is not called a broken HTTP link.
Known redirect aliases reuse observed terminal responses without another request.
Targets blocked by robots, outside scope, failed before headers, or beyond crawl
limits remain not checked. URL fragments are removed and queries remain distinct.
`internal-link-coverage` discloses examined/retained targets and invalid/omitted
references. Limits are 200 targets and 200 source evidence entries per target;
all related source page URLs are retained even when snippets are truncated.
HTTP availability does not establish content quality, indexing or anchor validity.

`crawl.limits`, `crawl.stats` and `crawl.stopReason` disclose page-attempt, request,
time, concurrency, pacing and retained-HTML budgets. `coverage.limitReached` includes
crawl and discovery limits. Even an exhausted discovered queue does not establish
complete domain coverage or Google's index state. Robots responses are shared only
inside that request, then released; blocked/unknown rules prevent automated fetching.

## Live Response

Clients explicitly accepting `application/x-ndjson` can receive newline-delimited
`{ type, data }` frames on the POST connection. `progress` data contains phase,
current URL/origin, discovered/fetched/analyzed/skipped counts, bounded skipped
entries, limitReached and stopReason. Counts are observations of that request,
not a progress percentage or proof of total site size. `report` data is the ordinary
schema and appears once at the end; a post-header failure uses `error` data with
status `failed`. EOF without a terminal frame is incomplete. No stream state is
retained for reconnection, and progress is not an exportable report.
Progress includes the actual crawl limits and attempted-page count. The UI's limit
notice distinguishes a page-attempt budget from successfully fetched page count;
the notice and progress are cleared when cancelled, replaced, reloaded or left.
