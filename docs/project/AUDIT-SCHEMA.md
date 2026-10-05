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
the entire website passed. JavaScript is examined only with explicit render opt-in.

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

## Issue Groups

`issueGroups` groups only current fail/review issues by `ruleId`, without replacing
the individual `issues` or duplicating evidence. Each group has a stable prefixed
`id`, rule/title/category, `issueIds`, `count`, unique sorted `urls`, `severityCounts`
and member-proof `complete`. JSON-LD block numbers stay on individual checks;
their group uses a shared title. Pass/not-checked rules have no issue group.

The sum of group counts equals `issues.length`. Group severity sums equal the
report severity counters; the union of group URLs equals `summary.affected`.
These URLs can include affected non-HTML resources; they are not additional
fetched pages. Group completeness describes retained member evidence, not whole
website coverage. No group data survives the current request/page-local report.

The UI offers individual and grouped views. Filters select individual members
first, then recompute visible group counts, severity breakdowns and unique URLs.
The summary continues to describe the entire round; the table footer names the
filtered subset. Group details link to every matching issue and related URL;
only fetched HTML URLs get page-detail buttons. CSV always exports the same
filtered individual issues and full evidence, not synthetic group rows.

## JavaScript Comparison

`render: true` adds `pages[].render` for pages selected from actually fetched HTML
with executable scripts/load/error handlers (JSON-LD/data-only scripts do not
trigger execution). At most two eligible pages are rendered; static/non-2xx/XHTML,
unknown/denied robots, browser failures and later pages have explicit unavailable
reasons, not invented DOM. This does not change the original `html`, `metadata`,
initial-HTML checks, discovered URLs or page counts.

The initial document is replayed from the fetched decoded HTML at its original
final URL. Chromium runs in a fresh non-persistent context, preserving the page's
CSP. Before/after snapshots compare title, description, HTML canonical, h1 and
normalized DOM body text (not a visibility/accessibility/content-quality measure).
Body text excludes script/style/noscript/template and has full-value SHA-256,
length and a 2,000-character preview; a shortened preview does not change matching.
`changes` identifies fields with observed differences. `after.html` is serialized
rendered DOM with `sourceFormat: rendered-dom`, never original repository code or
an initial-HTML line reference. Engine versions, URL, timestamps and mode accompany
the result. Change/absence is not Google's indexing or rendering verdict.
Every attempted/selected render result has `indexing: { status: not-checked,
reason: not-search-engine-observation }`, including no-script, partial and failure
results. DOM differences do not create an indexing failure, ranking claim or
automatic SEO issue. Initial HTML/header checks remain initial-source evidence:
removing an initial noindex in JS does not turn that observation into a pass.
Google's own rendering/indexing is a different observation; see
[Google's JavaScript basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Same-origin GET scripts/styles/XHR/fetch are fulfilled through protected Node
transport with public pinned DNS, default ports, robots and per-hop checks. CDP
Fetch pauses every redirect hop; resources keep their actual final browser URL,
so relative module imports work after redirects. No browser request is continued
to the network. An offline context, deny-only proxy, disabled browser DNS/QUIC,
blocked WebRTC/WebTransport/workers/service workers/websockets, blocked subframe
and popup navigation, and disabled downloads/cache further restrict execution.
Cookies/auth/browser request headers are never forwarded; Set-Cookie is not replayed.
No report, source, HAR, trace, screenshot or storage state is written/exported.
Browser-owned temporary runtime profiles are disposed on close, not audit storage.
Chromium's sandbox stays enabled for untrusted browser code even when the checker
runs locally. Personal use does not require public deployment.

Limits apply across the render round: 20 seconds, 2 pages, 30 Node socket requests,
100 intercepted requests/retained resource records, serial network access paced
at least 250 ms (or robots crawl-delay), 512 KiB per resource/DOM snapshot, 10,000
DOM elements and 3 MiB asset allocation. Failed resource attempts conservatively
consume their reserved byte allowance. DOM observation waits 1 second after DOM
content load, then waits for the already queued resource work; it does not wait
for all possible future timers or interact with the page. `resources` contains
bounded observed statuses, refusals, omission counts and script/console-error counts,
never asset response bodies or raw runtime errors. `stats` describes the entire
render round, not each page individually.

Completed/partial refer to this bounded observation only. Blocked external assets,
images/fonts/media, HTTP failures, JS exceptions and incomplete metadata make the
comparison partial; any observed changes remain factual. Missing snapshots stay
not checked. `notChecked` discloses those pages. Lighthouse remains separate.
Per-page resource work is cancelled when the DOM observation ends. Context close
and all queued work finish before resource records are copied and completeness
is finalized, so a late refusal/error cannot leave a falsely completed snapshot.
Console errors (including CSP refusals) are counted without retaining/logging their
messages. A real infinite-script deadline and pending-asset cancellation are
covered by browser-backed tests; both close the browser and transport work.

## Manual Downloads

Manual JSON download serializes the entire current report, independently of issue
filters. It includes original and any rendered source proof as JSON strings, not
an executable HTML document. Even a zero-issue report is downloadable; no report
means no export. Generation uses a browser Blob only on an explicit click, never
a backend file/job/download URL. Refresh/new round clears the source report.
JSON adds an `export` metadata object (format, scope, export time) to a shallow
copy, never to the current report. CSV appends format/schema, request URL, round
start/completion/export times and selected filters to every exported issue row.
Filenames use the UTC completion timestamp and a page-local round sequence, not
the inspected URL or a stored job ID. CSV includes UTF-8 BOM for Thai spreadsheets.

## PageSpeed Insights

Explicit `pagespeed: true` requests four Lighthouse categories from the fixed
Google HTTPS provider endpoint, with a backend-only `PAGESPEED_API_KEY`.
Missing configuration makes no provider request. `lighthouse` includes status,
reason, provider, URL, request timestamps, requested/final URL, source fetchTime,
engine/version and returned mode when available. `categories` keeps source scores
in [0,1]; `displayScore` only rounds score * 100 for presentation. Null/missing/
invalid values are unavailable, not zero. Runtime errors never publish scores.
Partial means some source scores are unavailable. HTML issues/summary stay separate.
No provider body/error/screenshot is logged or retained; only allowlisted facts
enter the current report. API failures keep the HTML report with no fallback scores.
The request is cancelled on disconnect, is capped at 90 seconds/8 MiB, refuses
provider redirects, and uses shared pinned public DNS transport. See
[setup and external validation still needed](PAGESPEED.md).

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

`canonical-target` compares each fetched page's canonical declaration with observed
target HTTP status/redirects, applicable robots directives and the target's own
canonical declarations. Same-origin canonical-only targets join the existing
bounded crawl queue; other origins and refused/unread targets are not fetched.
Default ports/fragments are normalized for fetching, but fragment declarations
remain review evidence. Conflicting/invalid/incomplete declarations cannot pass.
Annotation parameters are retained and require review, not an assumed accepted
Google canonical annotation. No new limits or client-controlled budgets are added.

A different healthy target is review for owner confirmation, not proof that the
source page is defective. `details.contentComparison: not-performed` makes clear
that duplicate-content similarity and Google's selected canonical are unverified.
Observed 4xx/5xx and HTTP loops are findings; 401/403/429, redirects, target noindex,
expiry directives and target canonical chains/direct two-page cycles need review.
`urls` contains affected source pages, not healthy target pages. Evidence identifies
the target's actual HTML location or response header. Non-HTML targets expose only
known HTTP/header facts; absent HTML directives are never inferred from them.
Unavailable targets, declaration/robots extraction gaps and the 200-entry evidence
cap produce `complete: false` and a disclosed reason, even alongside a proven issue.
The rule describes direct target facts, not an exhaustive canonical graph audit.

`sitemap-url-target` groups each parsed urlset target with the sitemap files/loc
entry indices where it appears and compares it with observed HTTP/redirect facts
and applicable target noindex directives. Index entries locate sitemap files, not
page targets. `parsed-xml-value` evidence is the decoded/trimmed loc value from the
XML parser, never an invented raw XML snippet or repository/line location. The UI
shows these values as escaped text. Existing response aliases are reused.

Observed HTTP failures/loops are findings; redirects, 401/403/429 and noindex require
confirmation. Unknown/blocked/foreign/unread targets cannot be called HTTP failures.
Non-HTML/header-only results disclose unavailable HTML and do not establish absence
of noindex. `sitemap-invalid-loc` identifies unusable parsed location entries, while
`sitemap-restricted-loc` separately discloses syntactically valid URLs excluded by
the checker's port/credentials/length policy. Such exclusions are not SEO errors.
Missing/unread sitemap files do not become mandatory-file issues.

`sitemap-url-coverage` describes only parsed urlsets/observed targets, with a
200-target and 50-total-evidence-per-target cap, omitted/invalid/restricted entry
counts and truncated/unread file coverage. All related sitemap file URLs remain
in `details.sitemapFiles` even when repeated loc proof is capped. `summary.affected`
counts distinct affected URLs, including actually observed non-HTML resources and
sitemap documents with invalid loc entries; `summary.pages` separately counts
fetched HTML. The UI never creates fake page rows/detail buttons for non-HTML URLs.

`pages[].metadata.jsonLd` records count, retained scripts/bytes and extraction
coverage for initial-HTML `application/ld+json` data blocks (MIME case/parameters
normalized). Content remains raw script text; HTML entities are not decoded into
JSON quotes and JavaScript is never executed. Limits are 50 blocks, 128 KiB UTF-8
per block, 512 KiB retained JSON per page, depth 64 and 10,000 inspected JSON values.
Unavailable/oversized content is null with a reason, never a truncated string
passed to the JSON parser. Source snippets keep the existing parser/location cap.

`jsonld-syntax` uses native `JSON.parse()` and reports syntax/observed top-level
shape only. Scalar JSON is valid syntax but asks for document-shape confirmation.
Literal `@type` strings are observations, not expanded/validated Schema.org types;
context definitions are excluded from those type observations. A syntax pass is
not JSON-LD semantic validation or rich-result eligibility. `jsonld-semantics` in
`notChecked` discloses that distinction. No remote context/import/ID/src is loaded,
no eval/graph processor is run, and parser exceptions never expose raw messages.
`jsonld-extraction` discloses omitted blocks/byte limits; structure limits remain
not checked even if syntax is valid. Absence is count zero, not a mandatory failure.
Block IDs include their 1-based script index, preserved when adding crawl page URLs
so two blocks on one page cannot select each other's evidence. HTML evidence is
always escaped in the checker; CSV remains manual and current-round only.

`pages[].metadata.openGraph` is information for link sharing, not an SEO score or
mandatory ranking checklist. It records observed ordered `meta[property="og:..."]`
entries, including repeated/structured properties, decoded content, parsed HTML
positions and resolved URL values. No property is substituted for title/canonical,
and no image/audio/video/URL is fetched or loaded into the browser automatically.
The checker is not an Open Graph consumer/preview validator.
At most 100 entries are retained; the original 5,000-meta-node parser cap also
applies. `complete: false` discloses missing observation coverage in `notChecked`.
The page detail view shows values/source as escaped text, previews at most 1,024
characters per value with a shortening notice and retains bounded source evidence.
Missing, empty, repeated or unresolved fields never create SEO issues or scores.

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
