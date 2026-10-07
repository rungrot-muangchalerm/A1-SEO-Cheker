# Audit Check Contract

`POST /api/audits` with only `{ "url": "http://localhost:5173/" }` enables discovery,
crawl, JavaScript comparison and local Lighthouse/Agentic by default. `strategy`
defaults to `mobile`; `desktop` is also available. Explicit boolean flags can scope
API-only requests, but the browser UI has no audit-selection checkboxes.
Ordinary clients receive one JSON report; `Accept: application/x-ndjson` receives
progress frames and one terminal report on the same connection. Neither mode stores
reports, issues job IDs or creates a polling/history endpoint.

The report schema is `2.0`. Each page contains `checks`;
`issues` contains only checks with a fail or review outcome, never every check.

Version 2 removes source-document payloads from both JSON and NDJSON responses and
manual exports. `pages[].html`, raw `headers`/`rawHeaders`, renderer `after.html`,
body-text previews/hashes, parser `meta`/`titles`/`descriptions`/`links`/`images`
inventories and JSON-LD script contents are no longer public fields. HTML is still
fetched and analyzed internally; only the result projection crosses the API boundary.
No opt-in source dump is provided. Consumers of version 1 must update their schema.

Pages retain URLs, observed HTTP status/bytes/redirects, fetch/analysis statuses,
title/description/language, canonical values/parameters, heading values, OG values,
extraction counts/completeness and crawler availability. Markup and locations live
in relevant check/issue evidence, not a second raw-tag inventory. Sitemap summaries
retain HTTP status, type, counts and limits without duplicate `entries` arrays;
the complete discovered URL inventory remains in `discovery.urls`. `responses`
retains URL/status/redirect/fetch-error facts without upstream header collections.

Every check includes:

- `ruleId`, `ruleVersion`, and `id`: stable rule identity for comparison and export.
- `url` and `urls`: the audited page, not a guessed repository filename.
- `category`, `title`, `found`, `impact`, and `steps`: Thai factual findings and
  actions. Owner confirmation is explicit when intent cannot be inferred.
- `evidence`: actual markup, response facts, robots matching lines, or observations
  describing the scope of an absence check. `sourceUrl` locates the source document.
  A canonical/image entry's `url` is its resolved target, not the source document.
- `references`: labeled HTTPS links to primary Google, W3C or Open Graph documentation.

HTML snippets are serialized by the HTML parser, not byte-for-byte excerpts.
`sourceFormat: serialized-html` identifies this. HTML `location` is reported by
parse5 against the decoded, fetched HTML: 1-based start/end lines and columns,
0-based JavaScript string offsets with an exclusive end. Positions are not measured
in the serialized snippet or inferred from repository files. Implicit nodes have
no location. `sourceTruncated` marks shortened snippets. Absence observations contain selectors
and counts, never invented replacement markup. Robots line numbers are 1-based
positions in the fetched robots.txt. Filesystem paths are not inferred from URLs.
The detail panel displays document URLs, locations, header names and robots lines.
At most 50 evidence entries are previewed; copying or JSON includes the full evidence
returned by the API, including any disclosed parser truncation.

Passing one rule is not a ranking score, an indexing confirmation, or proof that
the entire website passed. JavaScript comparison is enabled by default at the API
boundary, within the renderer limits below; it can be disabled with `render: false`.

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

## Site Files and Optional Advice

`siteFiles` is an additive report field, separate from `issues` and severity/score
counters. It contains `robots-file` and `sitemap-file` observations for the final
page origin. Each entry has `label`, `status`, `statusLabel`, `found`, optional
`recommendation`, `steps`, `evidence`, `evidenceOmitted` and primary `references`.
`scope: checked-locations` restricts absence statements to observed locations;
they are not a full-domain file inventory. The field uses existing protected
robots/discovery responses, without extra requests or weaker network policies.

Statuses are `found`, `missing`, `invalid` (unexpected format, not a full semantic
validator) and `unavailable`. Only observed 404/410 responses support missing-file
advice. Access errors, throttling, network errors, bounded/incomplete discovery
and disabled discovery do not prove absence. A readable custom sitemap or index
prevents a missing-file recommendation even when `/sitemap.xml` returns 404.
Unexpected HTML robots responses are disclosed without changing crawl decisions.
Sitemap parser/type errors preserve actual HTTP response evidence when available.

Recommendations are conditional and informational: robots.txt manages crawling,
not authentication/index exclusion; sitemaps aid discovery, not guaranteed index
or rankings. The UI displays both statuses without opening issue details. Full
and filtered JSON retain these contextual observations; both XLSX scopes add a
`Site Files` worksheet when observations exist. No round/report is persisted.

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
only fetched HTML URLs get page-detail buttons. Filtered JSON always exports the same
filtered individual issues and full evidence, not synthetic group rows.

## JavaScript Comparison

Rendering adds `pages[].render` by default for pages selected from fetched HTML
with executable scripts/load/error handlers (JSON-LD/data-only scripts do not
trigger execution). At most two eligible pages are rendered; static/non-2xx/XHTML,
unknown/denied robots, browser failures and later pages have explicit unavailable
reasons, not invented DOM. This does not change internally fetched HTML, initial
metadata/checks, discovered URLs or page counts.

The initial document is replayed from the fetched decoded HTML at its original
final URL. Chromium runs in a fresh non-persistent context, preserving the page's
CSP. Before/after snapshots compare title, description, HTML canonical, h1 and
normalized DOM body text (not a visibility/accessibility/content-quality measure).
Body text excludes script/style/noscript/template. Full-value SHA-256 is used only
internally for matching. The response contains body-text length, not the preview,
hash or serialized DOM. `changes` identifies fields with observed differences.
Before/after summaries contain title, description, canonical and h1 values;
`sourceFormat: rendered-dom` identifies the after-summary, not a source dump or
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
transport with public pinned DNS/default ports or explicitly selected loopback
origin/port, robots and per-hop checks. CDP
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
filters. It includes findings, actions and localized evidence, never full initial
HTML or rendered DOM. Even a zero-issue report is downloadable; no report
means no export. Generation uses a browser Blob only on an explicit click, never
a backend file/job/download URL. Refresh/new round clears the source report.
JSON adds an `export` metadata object (format, scope, export time) to a shallow
copy, never to the current report. Filtered JSON keeps schema, request URL, round
start/completion times, context summary/coverage, selected issues and recalculated
issue groups. Its `export.scope` is `filtered-issues`, with selection metadata in
`export.filters`; the full report continues to use `entire-round`.
Filenames use the UTC completion timestamp and a page-local round sequence, not
the inspected URL or a stored job ID. CSV is no longer generated.

Each scope also has a browser-only ExcelJS XLSX projection for manual Google Sheets
import. JSON preserves the structured result and localized evidence;
XLSX contains Summary, Issues, Issue URLs and Evidence, plus Pages, Scores, Agentic,
Not Checked, Discovered and Skipped for whole-round exports. Every cell is literal;
formula prefixes are neutralized only in XLSX, not the JSON or in-memory report.
Long values are split into ordered JSON chunks in Long Text, not silently truncated.
Writer failure, missing library or size limits preserve the JSON export option.

## Local Lighthouse

Lighthouse runs by default (`lighthouse: false` disables it), using 13.5.0 with
local Chromium/Puppeteer, without API keys or a remote scoring endpoint.
The UI sends only URL/device mode; the API enables Lighthouse automatically.
The four categories describe the input URL only, never an average over the crawl.
`lighthouse` includes status,
reason, provider, URL, request timestamps, requested/final URL, source fetchTime,
engine/version and returned mode when available. `categories` keeps source scores
in [0,1]; `displayScore` only rounds score * 100 for presentation. Null/missing/
invalid values are unavailable, not zero. Runtime errors never publish scores.
Partial means missing scores or incomplete network coverage; existing numeric
scores remain actual engine output, not recomputed estimates. HTML issues/summary
stay separate. Runtime failures publish no scores or raw error messages.
No raw LHR, trace, screenshot or report is written to disk or logged. Browser
temporary profiles are disposed on close. Disconnect closes the browser and aborts
pending Node sockets before releasing admission. Browser failures keep HTML findings.
Limits: 90 seconds, 10-second launch, 300 page and auxiliary requests, 4 MiB per resource,
32 MiB total allocation and 5 redirects. Failed resources consume reserved allowance.
Network records are capped at 100 with 8,192-character URL previews and explicit
`urlTruncated` flags; omissions make the result partial. `network`
includes actual successful bytes, allocation usage, limits and bounded refusal facts.
`limitations` discloses protected GET-only transport, no cookies/auth, same-origin
navigation, no subframes/popups/workers/service workers/websockets/WebRTC, and lab
data rather than field data. This can differ from unrestricted DevTools Lighthouse.
Images/fonts and public CDN resources may load through DNS-pinned default-port GET;
only the selected local origin can access loopback. Browser direct networking is
blocked by a deny-only proxy. See [local setup](LOCAL-LIGHTHOUSE.md).

`agentic` comes from the actual `agentic-browsing` category (fraction format),
requiring source Chrome/Chromium 150+. `passed`/`total` count verified binary/numeric
audits with Lighthouse's >=0.9 pass threshold; `failed`, `notChecked`, `excluded`
and `informational` remain separate. Errors, policy refusals and missing evidence
are not failures. `engineFraction` preserves Lighthouse's own ratio (which includes
errors in its denominator) when its source refs are complete. Partial observations
retain valid audit results; no applicable checks yields not-checked, never 100.
Rows include ID/title/mode/status, score when valid, reason for unavailable audits,
bounded text and allowlisted node/table evidence (20 entries, 100 visited items,
256-character titles, 2048-character descriptions/snippets, 1024-character table
text). Explicit `truncated` identifies limited evidence; raw details/runtime errors
are not retained. Hidden refs are excluded; manual/N/A/informative rows remain
visible but do not affect the ratio. JSON/XLSX use the same current-round results.
Per-run official gatherer instances use the protected Node transport for robots,
llms.txt and catalog discovery, rather than CDP resource loading. Headers are
allowlisted (including Link); all requests share DNS/robots/byte/cancellation limits.
Optional resource 404s are factual N/A results, not network-incomplete failures.
WebMCP is observed only; no tools/forms are executed and no origin trial is faked.

## Local Target Policy

The API derives local permission only from the selected HTTP(S) target hostname
(`localhost`, `127.0.0.1`, `[::1]`), not client-supplied policy flags. Local ports
are permitted except the checker's listening port (`CHECKER_TARGET`). Connections
pin to literal loopback; all local redirects/discovered URLs must stay on the
selected origin. Aliases, other ports and LAN/private IPs remain blocked. A public
target cannot gain local permission by redirecting or through body options.
`scope.environment: local-development` identifies local reports. HTTP is supported;
HTTPS still requires a trusted certificate. Local lab audits cannot verify public
availability, Google indexing or ranking. The checker itself remains loopback-only.

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

Default crawling uses scope `same-origin-crawl` unless explicitly disabled with
`crawl: false`. `pages` contains only fetched HTML,
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
references. Target limits follow the discovery URL budget (10,000 by default),
with 200 source evidence entries per target;
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
configured discovery target budget and 50-total-evidence-per-target cap, omitted/invalid/restricted entry
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
always escaped in the checker; JSON/XLSX remain manual and current-round only.

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
Each analyzed page now has an `open-graph` check in category `sharing`. Missing
core properties (`og:title`, `og:type`, `og:image`/`og:image:url`, `og:url`), empty
core/description fields, properties outside head, non-absolute/non-HTTP/credential
URLs and different core title/type/URL values produce a conditional `review`, not
an indexing failure. Missing `og:description` is explicitly optional advice.
Repeated images and structured properties remain legal; matching repeated core
values do not cause a finding. Text need not equal title or meta description.
An observed og:url disagreement with a single unqualified valid canonical is a
review of intent, not proof that either URL is wrong. No canonical target or media
fetch is added. Non-2xx pages are not checked for missing sharing metadata.
Incomplete extraction can retain proven bad fields but cannot infer absence.
`details.findings` contains property/code/message; existing evidence/actions flow
through individual/grouped issues, full/filtered JSON and Issues/Details in XLSX.
No Lighthouse score is changed and social preview/image accessibility is unverified.

Duplicate title/description rules are version 1.1. Exact normalized matching and
value-based IDs are unchanged. `details.reuse` adds matched/eligible counts, whether
every eligible page in this round reused the value, distinct complete nonempty H1
sets, a shared declared canonical when every declaration is unambiguous, and
observed Googlebot noindex counts. These are context, not semantic content equality,
Google-selected canonical or a penalty diagnosis. URL queries are never rewritten
or merged by this rule. Empty/non-2xx/ambiguous metadata exclusions remain disclosed.
At most 50 page contexts, five H1 previews of 512 characters and ten canonical
targets per page are retained, with omission/truncation flags and source evidence.
H1 comparison uses full normalized values, not previews. Incomplete headings,
qualified/incomplete canonical and incomplete directives cannot establish absence
or a shared canonical. Findings and steps distinguish different page purposes from
intentional aliases/noindex, including template reuse on password-reset pages.

`crawl.limits`, `crawl.stats` and `crawl.stopReason` disclose page-attempt, request,
time, concurrency, pacing and retained-HTML budgets. `coverage.limitReached` includes
crawl and discovery limits. Even an exhausted discovered queue does not establish
complete domain coverage or Google's index state. Robots responses are shared only
inside that request, then released; blocked/unknown rules prevent automated fetching.
Default crawl budgets are 5,000 page attempts, 40,000 request attempts, one hour
and 128 MiB of retained HTML. Discovery allows 10,000 URLs, 100 sitemap files
and five minutes. All are validated server environment settings; request bodies
cannot override them. A failed page attempt does not end the crawl unless a
round-wide budget is exhausted. Internal-link and sitemap target checks use the
configured discovery URL budget, so targets beyond 200 are not silently omitted.

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
