# SEO Checker

This project uses the original local DevTeam EJS framework. Keep its entry point
and routing conventions; implement SEO features in routes, controllers, services,
and data modules. Do not add audit history or persistence.

## Current Implementation

- Bounded crawling compares parsed sitemap urlset entries with actual HTTP,
  redirect and target noindex evidence. Nested index files are distinguished from
  page URL entries. Findings identify sitemap files and loc entry indices with
  parsed values displayed as text, not guessed source lines. Missing/blocked/
  unread maps or targets stay unavailable; noindex/redirect intent needs review.
  Syntactically valid URLs excluded by fetch policy are not called malformed SEO
  URLs. Caps are 200 targets and 50 evidence entries per target, with omitted work
  disclosed. Affected URLs and fetched HTML page counts remain separate.

- Canonical comparison is enabled by bounded crawling. Canonical-only internal
  targets enter the same queue, pacing, robots rules and page/request/time budgets.
  It compares observed target HTTP/redirects, initial-HTML/header noindex directives
  and the target's canonical declaration. Different healthy targets require owner
  confirmation; they are not automatically errors. HTTP failures retain actual
  status; outside-scope/unread targets and unavailable HTML remain incomplete.
  Source/target declaration positions and headers are evidence. Similarity of
  content, Google-selected canonical and a full canonical graph are not verified.

- Bounded crawling checks internal href destinations using only observed HTTP
  responses. Findings retain source pages, HTML positions, destination URLs,
  actual statuses and redirect chains. Non-HTML 404/410 responses remain evidence;
  successful PDFs are not called broken links. Access restrictions (401/403),
  rate limiting (429), and terminal 3xx require confirmation. Blocked/unread URLs
  stay not checked, and redirect loops never receive a guessed terminal status.
  Existing response aliases are reused without extra requests. Target/evidence
  caps and incomplete extraction are disclosed. Response facts live only in the
  current round and report; no history, response-body archive or persistent cache
  is created.

- `POST /api/audits` accepts JSON `{ "url": "https://example.com/" }`.
- Optional `crawl: true` follows same-origin links from every fetched HTML page
  plus the initial sitemap discovery. The separate crawl checkbox enables this.
  It checks robots.txt for SEOChecker before the initial URL and each redirect,
  refusing unknown/disallowed rules; Googlebot findings remain separate.
  Limits are 20 page attempts including failures/root, one request at a time,
  at least 500 ms between all sockets (robots, sitemap and redirects included),
  60 total request attempts, 60 seconds, and 8 MiB of retained HTML. A greater
  SEOChecker crawl-delay is honored, never clamped down. The current round alone
  shares robots responses; no cache survives the request. Child failures/skips
  retain reasons without inventing HTTP status or page content. Scope, real counts,
  skipped URLs and stop reason describe bounded coverage, not the entire domain.
  A Thai limit notice shows the actual bound and successfully read count. Limit
  skips remain separate from blocked, failed or duplicate destinations. Cancellation
  during DNS, robots, pacing, sitemap or child requests releases sockets/listeners
  and returns no partial report. Refresh/replacement also clear live progress;
  stale progress/final frames cannot overwrite a newer round, even if abort is ignored.
- Crawl UI requests `Accept: application/x-ndjson` on the same POST connection.
  Progress frames contain real discovered/fetched/analyzed counts and bounded skipped
  URL reasons. One report frame finishes the stream; there are no job IDs, polling,
  reconnect or resume routes. JSON clients keep ordinary HTTP responses. Failures
  before streaming preserve their HTTP status; after headers, an error frame ends
  the stream. Backpressure pauses writes and disconnect aborts waiting/work.
  Browser decoding supports split UTF-8/JSON chunks, a 64 Mi-character frame cap,
  and rejects missing/duplicate terminal reports instead of displaying partial data.
- Optional `discover: true` also finds same-origin URL candidates from the initial
  page's links, robots.txt sitemap declarations and `/sitemap.xml`. The checkbox
  enables this explicitly; ordinary single-page requests do not fetch sitemaps.
  `discovery` records URLs and their sources, sitemap HTTP/XML evidence and skipped
  candidates. Found URLs are not added to fetched/analyzed page counts. Discovery
  alone does not crawl pages. Nested sitemap indexes retain parent file evidence.
  Limits: 200 candidates, 5 sitemap files including index children, 200 detailed
  skips, 1,000 XML entries per file, depth 20, and a 10-second discovery deadline;
  sitemap transport is at most 5 seconds and 512 KiB per file.
  Scope uses the final requested page's exact origin (scheme, host and port), not
  a hostname substring. Follow-up robots/sitemap requests check that origin before
  DNS and on every redirect. Subdomains and cross-scheme URLs are outside scope;
  cross-origin redirects are disclosed as unavailable, never fetched implicitly.
  The explicitly requested initial URL can redirect to establish the final origin.
  URL identity uses the native URL parser, removes fragments, and normalizes hosts,
  default ports and dot segments. Query values/order, path case and trailing slashes
  stay intact. Sitemap references are deduplicated before entering a 200-item queue;
  ancestor cycles and redirect aliases do not cause repeated traversal.
  Saxes strictly validates XML/namespaces/entities before Fast XML Parser extracts
  data. Real DTDs and non-UTF-8 declarations are rejected, not harmless comments.
  Wrong XML, MIME, private redirects
  or unsupported encodings are disclosed rather than replaced with fake URLs.
  Saxes 6's upstream repository is archived; it is used only as a bounded, non-network
  XML syntax validator. Keep dependency audits and malformed-XML regression tests.
- The response uses schema version `1.0` with `pages`, `issues`, `notChecked`,
  `coverage`, `summary`, timestamps, and a Lighthouse availability state. Each page
  contains actual HTTP status, headers, HTML, final URL, and redirect evidence.
- Each page includes parsed metadata, headings, links, and images with HTML
  evidence. Relative URLs honor the document base URL. HTML byte decoding respects
  BOM, response charset, and meta charset. Element/evidence limits are disclosed.
- Crawl reports include `siteChecks` for duplicate title/description values across
  fetched 2xx HTML pages. Each matching group has all related URLs, original parsed
  source positions and a stable value-based ID. Text comparison collapses whitespace
  but preserves case; empty/ambiguous declarations and error templates do not become
  invented duplicates. Ambiguous/truncated evidence discloses incomplete comparison.
  Findings require owner confirmation, not an automatic ranking/indexing verdict.
  Group previews are capped at 512 characters; exact comparison uses the full parsed
  value. Long previews/evidence disclose truncation. Only observed pages are compared.
- Status is currently `partial`: HTTP status, Googlebot meta/header rules,
  missing title/description, and canonical declaration validity are checked,
  alongside image alt and robots.txt crawl rules (eight initial-page rules).
  Canonical reads HTML and HTTP Link headers. Each check separates facts from
  required owner confirmation; noindex is not assumed to be unintentional.
  Empty issues must not be read as a complete passing audit.
- `notChecked` identifies unavailable rules and unexamined rendered content,
  Lighthouse, unexamined site scope, and canonical target analysis. Page analysis can
  complete for initial-page rules while the overall report remains partial.
  See [the check contract](AUDIT-SCHEMA.md) for outcomes and evidence semantics.
- Image checks distinguish missing alt from explicit empty alt and do not evaluate
  whether a description matches the image. The robots.txt parser checks Googlebot
  and SEOChecker independently, reports matching lines, and never treats crawl
  blocking as noindex. A 4xx robots response except 429 means absent rules; 429,
  5xx and network failures remain unknown without pretending to know Google's cache.
- robots.txt uses the same protected, bounded transport: 5 seconds, 500 KiB,
  5 redirects, UTF-8. Parsing is capped at 2,000 lines, 2,048 characters per line,
  and a conservative wildcard work budget; exceeding a cap means not checked.
- There is no audit ID, saved report, database write, cookie, or resume endpoint.
- The URL form sends POST requests and holds the current API report only in
  page memory. Mock data and mock scores have been removed. Summary, issue/page
  tables, and both detail views use that one report; errors never substitute fixtures.
  HTML and headers are displayed as escaped evidence, not reconstructed examples.
  Loading, partial/completed coverage, no findings, and failure states are distinct.
  Scope, real coverage counts, completion time, and unavailable checks remain visible
  even when no issues were found. Starting another round clears the prior details.
  Issue/page filters operate on API data. Copy buttons copy actual evidence or
  numbered advice; they do not invent replacement markup. CSV contains only filtered
  issues and their evidence/advice, created in a Blob on an explicit button click.
  CSV quotes all fields and prefixes risky spreadsheet cells with an apostrophe;
  the in-memory report stays unchanged. Spreadsheet programs differ, especially
  after re-saving CSV; see [OWASP's CSV injection guidance](https://owasp.org/www-community/attacks/CSV_Injection).
  A monotonically increasing request round guards success, failure and finalization.
  An obsolete response cannot replace the current report or stop its loading state,
  including consecutive requests for the same URL.
  Evidence details display fetched document URLs, parser-reported HTML lines/columns,
  HTTP header names and matching robots.txt lines, never assumed repository filenames.
  Starting a new round aborts the previous fetch with AbortController. Manual cancel
  and leaving/reloading the page also abort in-flight requests; API disconnect handling
  stops backend work. Refresh starts with empty URL, filters, tables and details.
  Reports exist only in page-local JS memory. pagehide and persisted pageshow clear
  result DOM and references, so Back cannot restore a report. No audit data is written
  to local/session storage, IndexedDB, cookies, service workers or Cache Storage.
  Download object URLs are released after use and revoked when leaving the page.
  Failures that occur during display also clear partial result DOM and disable export.
- Only HTTP/HTTPS on ports 80/443 are supported. Credentials and non-public
  destinations are rejected. Defaults: 15 seconds, 2 MiB HTML, 5 redirects.
- gzip, deflate, and Brotli are decoded with limits on both transferred and
  decompressed bytes. Redirect hops share the same deadline.
- Audit responses, errors, and unknown-report routes use `Cache-Control: no-store`.
  An audit-scoped error middleware handles malformed JSON without logging input.
  The original entry point only adds the middleware's error hook after its router.
- Disconnecting the client aborts DNS waiting and in-flight upstream requests;
  completed or cancelled requests remove their abort and response listeners.

## Run

```sh
npm ci
npm start
node --test
```

Node.js 20.18.1 or newer is required by the HTML parser.
Focused test discovery is available with `node --test test/*.test.js`. The suite
includes good/bad HTML fixtures served through real HTTP, changing bytes on the
same URL, and changing only response headers through the framework API routes.
Frontend tests use Playwright with installed Google Chrome (`channel: chrome`).
Exact Bootstrap/Lucide npm versions provide offline CDN test fixtures; production
HTML continues to use the user's CDN URLs.

The upstream framework's dev dependencies currently produce three high-severity
`npm audit` entries in the nodemon dependency chain. They have been left unchanged
to preserve the supplied framework; `npm audit --omit=dev` reports no findings.
