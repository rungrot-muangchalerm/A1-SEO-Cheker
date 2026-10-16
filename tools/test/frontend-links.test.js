const test = require('node:test');
const assert = require('node:assert/strict');
const { frontend, scan, report } = require('./helpers/frontend');

test('audit advice renders Markdown and plain web links without enabling HTML or script links', async t => {
  const { page, errors } = await frontend(t);
  const result = report('https://fixture.example/');
  result.core_technical_checks = [{
    id: 'agentic:webmcp-form-coverage', title: 'WebMCP', group: 'agentic', scope: 'single-url',
    status: 'review', statusLabel: 'Review',
    found: 'See [WebMCP](https://developer.chrome.com/docs/ai/webmcp) and https://example.com/docs',
    recommendation: '<img src=x onerror=alert(1)> [unsafe](javascript:alert(1))'
  }];
  await page.route('**/api/audits', route => route.fulfill({ json: result }));
  await scan(page, 'https://fixture.example/');
  const section = page.locator('#core-technical-list');
  await page.locator('#core-technical-section > summary').click();
  await section.locator('summary').click();
  assert.equal(await section.locator('a').count(), 2);
  const link = section.getByRole('link', { name: 'WebMCP', exact: true });
  assert.equal(await link.getAttribute('href'), 'https://developer.chrome.com/docs/ai/webmcp');
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(await section.locator('img, script, a[href^="javascript:"]').count(), 0);
  assert.deepEqual(errors, []);
});
