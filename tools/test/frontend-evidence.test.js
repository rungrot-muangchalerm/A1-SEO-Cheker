const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report, bad } = require('./helpers/frontend');
const { stubTransport } = require('./helpers/transport');

test('HTML evidence names the fetched document and parser location, not an assumed repository file', async (t) => {
  const { page, errors } = await frontend(t);
  const url = 'https://fixture.example/catalog';
  const result = report(url, bad);
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, url);
  await page.locator('[data-issue-id="image-alt"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  const entry = result.issues.find((issue) => issue.ruleId === 'image-alt').evidence[0];
  const panel = page.locator('[data-evidence-kind="html"]').first();
  assert.ok((await panel.textContent()).includes(url));
  assert.ok((await panel.textContent()).includes(entry.selector));
  assert.ok((await panel.textContent()).includes(entry.location.startLine + ':' + entry.location.startColumn));
  assert.equal(await panel.locator('code').last().textContent(), entry.source);
  assert.equal(await panel.locator('img').count(), 0);
  assert.equal((await page.locator('#detail-content').textContent()).includes('index.ejs'), false);
  assert.deepEqual(errors, []);
});

test('headers, robots matching lines and absent elements have distinct factual locations', async (t) => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/bad', '<head></head><body>Page</body>', {
    headers: { 'x-robots-tag': 'Googlebot: noindex' },
    robots: { kind: 'robots', url: 'https://fixture.example/robots.txt', status: 'checked', httpStatus: 200,
      googlebotAllowed: false, rules: [{ agent: 'Googlebot', line: 3, source: 'Disallow: /bad' }] }
  });
  await page.route('**/api/audits', (route) => route.fulfill({ json: result }));
  await scan(page, result.requestedUrl);
  for (const [id, kind, expected] of [
    ['robots-indexing', 'header', ['HTTP header: X-Robots-Tag', 'Googlebot: noindex']],
    ['robots-crawling', 'robots', ['https://fixture.example/robots.txt', 'Googlebot', 'Disallow: /bad', '\u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14 3']],
    ['title-content', 'observation', ['head > title', '\u0e1e\u0e1a 0 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23']]
  ]) {
    await page.locator('#issue-rows [data-issue-id="' + id + '"]').click();
    await page.locator('#issue-drawer.show').waitFor();
    const panel = page.locator('[data-evidence-kind="' + kind + '"]').first();
    const text = await panel.textContent();
    for (const value of expected) assert.ok(text.includes(value));
    if (kind === 'observation') {
      assert.equal(await panel.locator('pre').count(), 0);
      assert.equal(text.includes('\u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14'), false);
    }
    await page.locator('#issue-drawer [data-bs-dismiss="offcanvas"]').click();
    await page.locator('#issue-drawer.show').waitFor({ state: 'hidden' });
  }
  assert.deepEqual(errors, []);
});

test('actual API HTML with scripts, event attributes, iframe and markup in metadata stays inert in lists and evidence', async t => {
  const payload = '<img src="https://attacker.example/leak" onerror="globalThis.__evidenceXss=true">';
  const encoded = payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const source = '<!doctype html><html><head><title>' + encoded + '</title><meta name="description" content="' + encoded + '">' +
    '</head><body><h1>' + encoded + '</h1><img src="https://attacker.example/leak" onerror="globalThis.__evidenceXss=true">' +
    '<svg onload="globalThis.__evidenceXss=true"></svg><iframe src="https://attacker.example/frame"></iframe>' +
    '<script>globalThis.__evidenceXss=true;</script></body></html>';
  const transport = stubTransport(t, [{ html: source }, { status: 404 }]);
  const { page, errors } = await frontend(t);
  let attackerRequests = 0, dialogs = 0;
  page.on('request', request => { if (request.url().includes('attacker.example')) attackerRequests++; });
  page.on('dialog', dialog => { dialogs++; return dialog.dismiss(); });
  const event = page.waitForResponse(response => response.url().endsWith('/api/audits'));
  await scan(page, 'https://fixture.example/untrusted');
  const result = await (await event).json();
  assert.equal(transport.calls.length, 2);
  assert.equal(result.pages[0].metadata.title, payload);
  const issue = result.issues.find(item => item.ruleId === 'image-alt');
  await page.locator('[data-issue-id="' + issue.id + '"]').click();
  await page.locator('#issue-drawer.show').waitFor();
  assert.equal(await page.locator('[data-evidence-kind="html"] code').last().textContent(), issue.evidence[0].source);
  assert.ok((await page.locator('#detail-content').textContent()).includes('onerror'));
  await page.locator('#issue-drawer [data-bs-dismiss="offcanvas"]').click();
  await page.locator('#issue-drawer.show').waitFor({ state: 'hidden' });
  await page.locator('#pages-tab').click();
  assert.ok((await page.locator('#page-rows').textContent()).includes(payload));
  await page.locator('#page-rows [data-page-url]').click();
  await page.locator('#issue-drawer.show').waitFor();
  assert.equal((await page.locator('#detail-content details code').allTextContents())[1], source);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => globalThis.__evidenceXss), undefined);
    assert.equal(await page.locator('[onerror], [onload], iframe, img[src*="attacker.example"]').count(), 0);
    assert.equal(await page.locator('#detail-content script').count(), 0);
  }
  assert.equal(attackerRequests, 0);
  assert.equal(dialogs, 0);
  assert.deepEqual(errors, []);
});
