const test = require('node:test');
const assert = require('node:assert/strict');
const timers = require('node:timers/promises');
const html = require('../../app/service/html.service');
const cross = require('../../app/service/cross-page.service');
const audit = require('../../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, setAuditOptions } = require('./helpers/frontend');

const markup = (title, description, path, links = '') => '<title>' + title + '</title><meta name="description" content="' + description +
  '"><link rel="canonical" href="' + path + '"><meta property="og:title" content="' + title +
  '"><meta property="og:type" content="website"><meta property="og:image" content="https://site.example/image.jpg">' +
  '<meta property="og:url" content="' + new URL(path, 'https://site.example').href + '"><meta property="og:description" content="' + description + '">' + links;
function page(path, title, description, status = 200) {
  const data = { finalUrl: 'https://site.example' + path, html: markup(title, description, path), status };
  data.metadata = html.parse(data);
  return data;
}
function clock(t) {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(timers, 'setTimeout', async (delay, _value, options) => { options.signal.throwIfAborted(); now += delay; });
}
const responses = () => [{ status: 404 }, { html: markup('Root', 'Root description', '/', '<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>') },
  { status: 404 }, { html: markup('Shared', 'Repeated', '/a') }, { html: markup('Shared', 'Repeated', '/b') },
  { html: markup('Different', 'Repeated', '/c') }];

test('duplicate groups contain actual source positions and all related URLs with stable value-based IDs', () => {
  const pages = [page('/a', 'Shared &amp; title', 'Same &amp; description'), page('/b', ' Shared &amp;  title ', 'Same &amp;\n description'),
    page('/c', 'Different', 'Same &amp; description')];
  const checks = cross.analyze(pages);
  assert.equal(checks.length, 2);
  assert.deepEqual(checks[0].urls, ['https://site.example/a', 'https://site.example/b']);
  assert.deepEqual(checks[1].urls, ['https://site.example/a', 'https://site.example/b', 'https://site.example/c']);
  assert.ok(checks.every((entry) => entry.outcome === 'review' && entry.severity === 'review' && entry.complete));
  assert.equal(checks[0].details.valuePreview, 'Shared & title');
  assert.equal(checks[1].details.valuePreview, 'Same & description');
  assert.ok(checks.every((check) => check.evidence.every((entry) => entry.sourceUrl && entry.location.startLine && entry.sourceFormat === 'serialized-html')));
  assert.deepEqual(cross.analyze([...pages].reverse()).map((entry) => entry.id), checks.map((entry) => entry.id));
});

test('empty values, error templates and a single document/alias do not produce invented duplicate findings; case stays significant', () => {
  const cases = [
    [page('/a', '', ''), page('/b', '', '')],
    [page('/a', 'Missing', 'Missing', 404), page('/b', 'Missing', 'Missing', 500)],
    [page('/a', 'Same', 'Same'), page('/a', 'Same', 'Same')],
    [page('/a', 'Case', 'Case'), page('/b', 'case', 'case')]
  ];
  for (const pages of cases) assert.ok(cross.analyze(pages).every((entry) => entry.outcome !== 'review'));
  assert.ok(cross.analyze(cases[2]).every((entry) => entry.outcome === 'not-checked' && entry.reason === 'insufficient-pages'));
  assert.ok(cross.analyze(cases[3]).every((entry) => entry.outcome === 'pass'));
});

test('ambiguous/truncated declarations disclose incomplete comparison even when a duplicate is proven elsewhere', () => {
  const pages = [page('/a', 'Shared', 'Repeated'), page('/b', 'Shared', 'Repeated'), page('/c', 'Other', 'Other')];
  pages[2].metadata.truncated.push('titles', 'meta');
  const findings = cross.analyze(pages);
  assert.ok(findings.every((entry) => entry.outcome === 'review' && entry.complete === false && entry.reason === 'metadata-incomplete'));
  assert.ok(findings.every((entry) => entry.details.excluded[0].reason === 'metadata-incomplete'));
  const multiple = page('/multiple', 'Other', 'Other');
  multiple.html += '<title>Conflict</title><meta name="description" content="Conflict">';
  multiple.metadata = html.parse(multiple);
  const result = cross.analyze([page('/single', 'One', 'One'), multiple]);
  assert.ok(result.every((entry) => entry.outcome === 'not-checked'));
});

test('long metadata comparison is exact while finding previews remain bounded and disclose truncation', () => {
  const value = 'x'.repeat(5000);
  const checks = cross.analyze([page('/a', value, value), page('/b', value, value), page('/c', value + 'y', value + 'y')]);
  assert.ok(checks.every((entry) => entry.urls.length === 2 && entry.details.valuePreview.length === 512 && entry.details.valueTruncated));
  assert.ok(checks.every((entry) => entry.evidence.every((evidence) => evidence.sourceTruncated)));
});

test('copied titles on home and password routes expose different H1, reuse extent and observed noindex without inventing penalties', () => {
  const root = page('/', 'Brand homepage', 'Shared description');
  const password = page('/reset-password', 'Brand homepage', 'Shared description');
  root.html += '<h1>Browse villas</h1>';
  password.html += '<h1>Change your password</h1><meta name="robots" content="noindex">';
  for (const item of [root, password]) item.metadata = html.parse(item);
  const title = cross.analyze([root, password])[0];
  assert.equal(title.outcome, 'review');
  assert.equal(title.ruleVersion, '1.1');
  assert.equal(title.details.reuse.allEligiblePages, true);
  assert.equal(title.details.reuse.distinctObservedH1, 2);
  assert.equal(title.details.reuse.noindexPages, 1);
  assert.equal(title.details.reuse.sharedDeclaredCanonical, null);
  assert.equal(title.details.reuse.contentEquivalenceValidated, false);
  assert.equal(title.details.reuse.googleCanonicalValidated, false);
  const context = title.details.reuse.pages.find(entry => entry.url.endsWith('reset-password'));
  assert.deepEqual(context.h1, ['Change your password']);
  assert.equal(context.noindex, true);
  assert.ok(context.evidence.some(entry => entry.source.includes('noindex') && entry.location));
});

test('query-space variants sharing a canonical keep exact URLs and suggest reviewing duplicate routing before retitling', () => {
  const a = page('/villa?slug=Vela', 'Vela', 'Vela details');
  const b = page('/villa?slug=Vela%20', 'Vela', 'Vela details');
  b.html = markup('Vela', 'Vela details', a.finalUrl);
  b.metadata = html.parse(b);
  const issue = cross.analyze([a, b])[0];
  assert.equal(issue.details.reuse.sharedDeclaredCanonical, a.finalUrl);
  assert.deepEqual(issue.urls, [a.finalUrl, b.finalUrl]);
  assert.ok(issue.steps.some(step => step.includes('canonical')));
  b.metadata.truncated.push('canonical');
  const incomplete = cross.analyze([a, b])[0];
  assert.equal(incomplete.details.reuse.sharedDeclaredCanonical, null);
  assert.equal(incomplete.details.reuse.pages[1].canonicalComplete, false);
});

test('reuse context is bounded, heading identity is not based on previews, and incomplete directives do not imply noindex absence', () => {
  const pages = Array.from({ length: 55 }, (_value, index) => {
    const item = page('/' + index, 'Shared title', 'Shared description');
    item.html += '<h1>' + 'x'.repeat(600) + index + '</h1>';
    item.metadata = html.parse(item);
    return item;
  });
  pages[0].metadata.truncated.push('meta', 'headings');
  const title = cross.analyze(pages)[0];
  assert.equal(title.details.reuse.pages.length, 50);
  assert.equal(title.details.reuse.pagesOmitted, 5);
  assert.equal(title.details.reuse.distinctObservedH1, 54);
  assert.equal(title.details.reuse.pages[0].noindexComplete, false);
  assert.equal(title.details.reuse.pages[0].h1PreviewTruncated, true);
});

test('actual crawl report includes cross-page checks in issue summaries and later changed HTML removes the duplicates', async (t) => {
  clock(t);
  const changed = responses();
  changed[4].html = markup('New title B', 'New description B', '/b');
  changed[5].html = markup('New title C', 'New description C', '/c');
  stubTransport(t, [...responses(), ...changed]);
  const first = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  assert.equal(first.summary.review, 2);
  assert.equal(first.summary.affected, 3);
  assert.equal(first.issues.length, 2);
  assert.equal(first.siteChecks.length, 8);
  assert.equal(first.summary.checks.pass + first.summary.checks.review, 43);
  assert.ok(first.issues.every((entry) => entry.ruleId.startsWith('duplicate-')));
  const second = (await audit.create({ url: 'https://site.example/', crawl: true })).data;
  assert.equal(second.issues.length, 0);
  assert.ok(second.siteChecks.filter((entry) => entry.ruleId !== 'sitemap-url-coverage').every((entry) => entry.outcome === 'pass'));
  assert.equal(second.siteChecks.find((entry) => entry.ruleId === 'sitemap-url-coverage').outcome, 'not-checked');
  assert.equal(first.issues.length, 2);
});

test('browser opens every grouped URL and actual evidence; JSON exports the whole duplicate group', async (t) => {
  clock(t);
  stubTransport(t, responses());
  const { page: browserPage, errors } = await frontend(t);
  const stacks = [];
  browserPage.on('pageerror', (error) => stacks.push(error.stack));
  setAuditOptions(browserPage, { crawl: true });
  await scan(browserPage, 'https://site.example/');
  assert.equal(await browserPage.locator('#summary-review').textContent(), '2');
  assert.equal(await browserPage.locator('#issue-rows tr').count(), 2);
  await browserPage.locator('[data-issue-id^="duplicate-description:"]').click();
  assert.equal(await browserPage.locator('#detail-content [data-page-url]').count(), 3);
  assert.equal(await browserPage.locator('#detail-content [data-evidence-kind="html"]').count(), 3);
  await browserPage.locator('#detail-content [data-page-url="https://site.example/c"]').click();
  assert.ok((await browserPage.locator('#detail-content').textContent()).includes('Different'));
  await browserPage.locator('#issue-drawer .btn-close').click();
  await browserPage.locator('#issue-drawer').waitFor({ state: 'hidden' });
  await browserPage.locator('#issue-search').fill('duplicate-description');
  const [download] = await Promise.all([browserPage.waitForEvent('download'), browserPage.locator('#export-button').click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(exported.issues.length, 1);
  assert.equal(exported.issues[0].ruleId, 'duplicate-description');
  assert.deepEqual(exported.issues[0].urls, ['/a', '/b', '/c'].map(path => 'https://site.example' + path));
  assert.deepEqual(errors, [], stacks.join('\n'));
});
