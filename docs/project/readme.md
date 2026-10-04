# SEO Checker

This project uses the original local DevTeam EJS framework. Keep its entry point
and routing conventions; implement SEO features in routes, controllers, services,
and data modules. Do not add audit history or persistence.

## Current Implementation

- `POST /api/audits` accepts JSON `{ "url": "https://example.com/" }`.
- The response contains this request's fetched page, HTTP status, headers, HTML,
  final URL, and redirect chain. It does not yet perform SEO analysis.
- There is no audit ID, saved report, database write, cookie, or resume endpoint.
- The frontend still uses mockup data until TODO round 3.
- Only HTTP/HTTPS on ports 80/443 are supported. Credentials and non-public
  destinations are rejected. Defaults: 15 seconds, 2 MiB HTML, 5 redirects.

## Run

```sh
npm ci
npm start
node --test
```

The upstream framework's dev dependencies currently produce three high-severity
`npm audit` entries in the nodemon dependency chain. They have been left unchanged
to preserve the supplied framework; `npm audit --omit=dev` reports no findings.
