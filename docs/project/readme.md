# SEO Checker

This project uses the original local DevTeam EJS framework. Keep its entry point
and routing conventions; implement SEO features in routes, controllers, services,
and data modules. Do not add audit history or persistence.

## Current Implementation

- `POST /api/audits` accepts JSON `{ "url": "https://example.com/" }`.
- The response uses schema version `1.0` with `pages`, `issues`, `notChecked`,
  `coverage`, `summary`, timestamps, and a Lighthouse availability state. Each page
  contains actual HTTP status, headers, HTML, final URL, and redirect evidence.
- Each page includes parsed metadata, headings, links, and images with HTML
  evidence. Relative URLs honor the document base URL. HTML byte decoding respects
  BOM, response charset, and meta charset. Element/evidence limits are disclosed.
- Status is currently `partial`: HTTP status, Googlebot meta/header rules,
  missing title/description, and canonical declaration validity are checked,
  alongside image alt and robots.txt crawl rules (eight initial-page rules).
  Canonical reads HTML and HTTP Link headers. Each check separates facts from
  required owner confirmation; noindex is not assumed to be unintentional.
  Empty issues must not be read as a complete passing audit.
- `notChecked` identifies unavailable rules and unexamined rendered content,
  Lighthouse, site-wide crawling, and canonical target analysis. Page analysis can
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
