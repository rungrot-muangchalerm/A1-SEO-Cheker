const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const audit = require('../../app/service/audit.service');
const renderer = require('../../app/service/render.service');
const { stubTransport } = require('./helpers/transport');
const { frontend, scan, report, good, setAuditOptions } = require('./helpers/frontend');

const base = 'https://site.example/';
const document = (scripts = '', title = 'Initial') => '<!doctype html><html><head><title>' + title +
  '</title><meta name="description" content="Initial description"><link rel="canonical" href="/"></head>' +
  '<body><main><h1>Initial heading</h1><p id="content">Initial body</p></main>' + scripts + '</body></html>';
const inline = '<script>document.title="Rendered title";document.querySelector("h1").textContent="Rendered heading";' +
  'document.querySelector("meta[name=description]").content="Rendered description";' +
  'document.querySelector("link[rel=canonical]").href="/rendered";' +
  'document.querySelector("#content").textContent="Rendered body";</script>';
const networkResponses = (markup, extra = []) => [{ html: markup }, { status: 404 }, { status: 404 }, ...extra];

test('real Chromium executes inline JS and compares initial title/description/canonical/h1/body text without replacing fetched HTML or inventing scores', async (t) => {
  const source = document(inline);
  const transport = stubTransport(t, networkResponses(source));
  const result = await audit.create({ url: base, render: true });
  assert.equal(result.ok, true);
  const page = result.data.pages[0];
  assert.equal(page.html, source);
  assert.equal(page.metadata.title, 'Initial');
  assert.equal(page.render.status, 'completed', JSON.stringify(page.render));
  assert.equal(page.render.before.title, 'Initial');
  assert.equal(page.render.after.title, 'Rendered title');
  assert.equal(page.render.after.description, 'Rendered description');
  assert.deepEqual(page.render.after.canonical, [base + 'rendered']);
  assert.deepEqual(page.render.before.h1, ['Initial heading']);
  assert.deepEqual(page.render.after.h1, ['Rendered heading']);
  assert.ok(page.render.after.text.preview.includes('Rendered body'));
  assert.equal(page.render.after.sourceFormat, 'rendered-dom');
  assert.deepEqual(page.render.changes, ['title', 'description', 'canonical', 'h1', 'body-text']);
  assert.ok(page.render.engine.version && page.render.engine.playwright);
  assert.ok(Number.isFinite(Date.parse(page.render.completedAt)));
  assert.equal(page.render.stats.requests, 1);
  assert.equal(transport.calls.length, 3);
  assert.equal(result.data.issues.length, 0);
  assert.deepEqual(page.render.indexing, { status: 'not-checked', reason: 'not-search-engine-observation' });
  assert.ok(!result.data.notChecked.some((entry) => entry.id === 'javascript-render'));
  assert.deepEqual(result.data.lighthouse.categories, []);
});

test('same-origin JS, redirected modules and JSON fetch use the pinned protected transport and retain actual response facts', async (t) => {
  const transport = stubTransport(t, networkResponses(document('<script type="module" src="/alias.js"></script>'), [
    { status: 302, headers: { location: '/scripts/app.js' } },
    { html: 'import "./child.js";', headers: { 'content-type': 'text/javascript' } },
    { html: 'fetch("/api/content").then(r=>r.json()).then(data=>{document.title=data.title;document.querySelector("#content").textContent=data.text});',
      headers: { 'content-type': 'application/javascript' } },
    { html: '{"title":"Fetched render title","text":"Fetched render body"}', headers: { 'content-type': 'application/json' } }
  ]));
  const result = (await audit.create({ url: base, render: true })).data;
  const rendered = result.pages[0].render;
  assert.equal(rendered.status, 'completed', JSON.stringify(rendered));
  assert.equal(rendered.after.title, 'Fetched render title', JSON.stringify({ rendered, calls: transport.calls.map((entry) => entry.url) }));
  assert.ok(rendered.after.text.preview.includes('Fetched render body'));
  assert.deepEqual(transport.calls.slice(3).map((entry) => entry.url), [base + 'alias.js', base + 'scripts/app.js', base + 'scripts/child.js', base + 'api/content']);
  assert.ok(transport.calls.every((entry) => typeof entry.options.lookup === 'function' && entry.options.agent === false));
  assert.equal(rendered.resources.records[0].status, 302);
  assert.equal(rendered.resources.records.at(-1).status, 200);
  assert.ok(rendered.resources.records.every((entry) => !entry.body && !entry.html));
});

test('renderer is explicit, only selects pages with executable content and caps eligible pages while disclosing unexamined pages', async (t) => {
  const transport = stubTransport(t, networkResponses(document(inline)));
  const untouched = (await audit.create({ url: base, render: 'true' })).data;
  assert.equal(untouched.pages[0].render, undefined);
  assert.equal(transport.calls.length, 2);
  t.mock.restoreAll();
  const jsonOnly = document('<script type="application/ld+json">{"@type":"Article"}</script>');
  const second = stubTransport(t, [{ html: jsonOnly }, { status: 404 }]);
  const noExecution = (await audit.create({ url: base, render: true })).data;
  assert.equal(noExecution.pages[0].render.reason, 'no-executable-script');
  assert.equal(noExecution.pages[0].render.indexing.status, 'not-checked');
  assert.equal(second.calls.length, 2);
  t.mock.restoreAll();
  stubTransport(t, [{ status: 404 }]);
  const pages = Array.from({ length: 3 }, (_, index) => report(base + 'p-' + index, document(inline)).pages[0]);
  await renderer.run(pages);
  assert.equal(pages[0].render.after.title, 'Rendered title');
  assert.equal(pages[1].render.after.title, 'Rendered title');
  assert.equal(pages[2].render.reason, 'RENDER_PAGE_LIMIT');
  assert.equal(pages[2].render.indexing.status, 'not-checked');
  assert.equal(pages[0].render.stats.attemptedPages, 2);
});

test('unknown/denied robots and unavailable browser report missing evidence, never a fake rendered snapshot or raw error/log', async (t) => {
  for (const [response, reason] of [[{ html: 'User-agent: SEOChecker\nDisallow: /' }, 'ROBOTS_BLOCKED'], [{ status: 503 }, 'ROBOTS_UNKNOWN']]) {
    stubTransport(t, [{ html: document(inline) }, { status: 404 }, response]);
    const result = (await audit.create({ url: base, render: true })).data;
    assert.equal(result.pages[0].render.reason, reason);
    assert.equal(result.pages[0].render.after, undefined);
    assert.equal(result.pages[0].render.indexing.status, 'not-checked');
    assert.ok(result.notChecked.some((entry) => entry.id === 'javascript-render' && entry.reason === reason));
    t.mock.restoreAll();
  }
  const logs = t.mock.method(console, 'error', () => {});
  stubTransport(t, networkResponses(document(inline)));
  t.mock.method(chromium, 'launch', async () => { throw new Error('Private launch details MUST NOT APPEAR'); });
  const result = (await audit.create({ url: base, render: true })).data;
  assert.equal(result.pages[0].render.reason, 'BROWSER_UNAVAILABLE');
  assert.equal(JSON.stringify(result).includes('Private launch details'), false);
  assert.equal(logs.mock.calls.length, 0);
});

test('blocked resources and script errors keep genuine observed DOM changes but make coverage partial; no silent complete snapshot', async (t) => {
  const transport = stubTransport(t, networkResponses(document(inline + '<script src="https://cdn.example/app.js"></script>' +
    '<script>throw new Error("Private script error must not be logged");</script>')));
  const result = (await audit.create({ url: base, render: true })).data;
  const rendered = result.pages[0].render;
  assert.equal(rendered.status, 'partial');
  assert.equal(rendered.after.title, 'Rendered title');
  assert.equal(rendered.complete, false);
  assert.equal(rendered.indexing.status, 'not-checked');
  assert.equal(rendered.resources.scriptErrors, 1);
  assert.ok(rendered.resources.records.some((entry) => entry.reason === 'OUTSIDE_SCOPE'));
  assert.equal(transport.calls.length, 3);
  assert.ok(result.notChecked.some((entry) => entry.id === 'javascript-render' && entry.reason === 'render-incomplete'));
  assert.equal(JSON.stringify(rendered).includes('Private script error'), true); // Source proof, not an error log.
});

test('new round executes changed current JS without carrying cookies/browser storage from the previous context or editing the earlier report', async (t) => {
  const source = document('<script>document.title=localStorage.getItem("old-title")||"Fresh context";localStorage.setItem("old-title","Old context");' +
    'document.cookie="audit=old";</script>');
  stubTransport(t, [...networkResponses(source), ...networkResponses(source.replace('Fresh context', 'Changed current code'))]);
  const first = (await audit.create({ url: base, render: true })).data;
  const second = (await audit.create({ url: base, render: true })).data;
  assert.equal(first.pages[0].render.after.title, 'Fresh context');
  assert.equal(second.pages[0].render.after.title, 'Changed current code');
  assert.equal(first.pages[0].render.after.title, 'Fresh context');
  assert.equal(second.pages[0].render.before.title, 'Initial');
});

test('API-rendered results display escaped before/after fields and DOM proof on desktop/mobile without a checkbox; refresh clears results', async (t) => {
  const source = document('<script>document.title="Rendered browser title";document.querySelector("#content").textContent=' +
    '"<img src=x onerror=globalThis.__renderXss=true>";</script>');
  stubTransport(t, networkResponses(source));
  const { page, errors } = await frontend(t);
  assert.equal(await page.locator('#render-pages').count(), 0);
  setAuditOptions(page, { render: true });
  await scan(page, base);
  await page.locator('#pages-tab').click();
  await page.locator('#page-rows [data-page-url]').click();
  await page.waitForFunction(() => {
    const drawer = document.getElementById('issue-drawer');
    return drawer.classList.contains('show') && !drawer.classList.contains('showing');
  });
  const comparison = page.locator('[data-render-comparison]');
  assert.ok((await comparison.locator('[data-google-index-status]').textContent()).includes('ยังตรวจไม่ได้'));
  assert.ok((await comparison.locator('[data-render-phase="before"]').textContent()).includes('Initial body'));
  assert.ok((await comparison.locator('[data-render-phase="after"]').textContent()).includes('Rendered browser title'));
  assert.equal(await comparison.locator('img, script, iframe').count(), 0);
  assert.equal(await page.evaluate(() => globalThis.__renderXss), undefined);
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await comparison.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.SEO_SCREENSHOTS === 'true') await page.screenshot({ path: path.join(os.tmpdir(), 'seo-checker-render-' + name + '.png'), fullPage: false });
  }
  await comparison.locator('summary').first().click();
  assert.ok((await comparison.locator('pre').textContent()).includes('document.title='));
  await page.reload();
  assert.equal(await page.locator('#render-pages').count(), 0);
  assert.equal(await page.locator('[data-render-comparison]').count(), 0);
  assert.equal(await page.locator('#detail-content').textContent(), '');
  assert.equal(await page.locator('#website-url').inputValue(), '');
  assert.deepEqual(errors, []);
});

test('added, removed and unchanged DOM text do not infer Google indexing, and removing initial noindex never overwrites its source check', async (t) => {
  const sources = [
    document('<script>document.querySelector("main").textContent="";</script>'),
    document('<script>void 0;</script>'),
    document('<script>document.querySelector("meta[name=robots]").remove();</script>').replace('</head>', '<meta name="robots" content="noindex"></head>')
  ];
  for (const source of sources) {
    stubTransport(t, networkResponses(source));
    const result = (await audit.create({ url: base, render: true })).data;
    const page = result.pages[0];
    assert.equal(page.render.indexing.status, 'not-checked');
    assert.ok(!result.issues.some((entry) => entry.ruleId.startsWith('javascript')));
    assert.equal(page.html, source);
    if (source.includes('name="robots"')) {
      assert.ok(!page.render.after.html.includes('name="robots"'));
      assert.equal(page.checks.find((entry) => entry.ruleId === 'robots-indexing').outcome, 'review');
    }
    t.mock.restoreAll();
  }
});
