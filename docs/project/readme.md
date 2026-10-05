# SEO Checker

This project uses the original local DevTeam EJS framework. Keep its entry point
and routing conventions; implement SEO features in routes, controllers, services,
and data modules. Do not add audit history or persistence.

## Current Implementation

- `POST /api/audits` accepts JSON `{ "url": "https://example.com/" }`.
- The response uses schema version `1.0` with `pages`, `issues`, `notChecked`,
  `coverage`, `summary`, timestamps, and a Lighthouse availability state. Each page
  contains actual HTTP status, headers, HTML, final URL, and redirect evidence.
- Status is currently `partial`: fetching is complete but SEO analysis has not yet
  been implemented. Empty issues must not be read as a passing audit.
- There is no audit ID, saved report, database write, cookie, or resume endpoint.
- The frontend still uses mockup data until TODO round 3.
- Only HTTP/HTTPS on ports 80/443 are supported. Credentials and non-public
  destinations are rejected. Defaults: 15 seconds, 2 MiB HTML, 5 redirects.
- gzip, deflate, and Brotli are decoded with limits on both transferred and
  decompressed bytes. Redirect hops share the same deadline.
- Audit responses, errors, and unknown-report routes use `Cache-Control: no-store`.
  An audit-scoped error middleware handles malformed JSON without logging input.
  The original entry point only adds the middleware's error hook after its router.

## Run

```sh
npm ci
npm start
node --test
```

The upstream framework's dev dependencies currently produce three high-severity
`npm audit` entries in the nodemon dependency chain. They have been left unchanged
to preserve the supplied framework; `npm audit --omit=dev` reports no findings.
