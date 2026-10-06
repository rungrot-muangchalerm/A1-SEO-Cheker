const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../../app/service/html.service');
const seo = require('../../app/service/seo.service');

function analyze(source) {
  const page = { finalUrl: 'https://site.example/page', html: source, headers: {}, status: 200, redirects: [] };
  page.metadata = html.parse(page);
  return seo.analyze(page).find((entry) => entry.ruleId === 'image-alt');
}

test('missing alt is detected separately from explicit decorative alt', () => {
  const result = analyze('<img src="missing.jpg"><img src="decoration.jpg" alt=""><img src="photo.jpg" alt="Team at work">');
  assert.equal(result.outcome, 'fail');
  assert.equal(result.severity, 'warning');
  assert.deepEqual(result.details, { total: 3, examined: 3, missingAlt: 1, emptyAlt: 1, meaningValidated: false });
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].src, 'missing.jpg');
  assert.equal(result.evidence[0].kind, 'html');
  assert.equal(result.evidence[0].hasAlt, false);
});

test('decorative alt, boolean alt and no images do not invent missing-alt issues', () => {
  for (const source of ['', '<img src="x" alt="">', '<img src="x" alt>', '<img src="x" ALT="Label">']) {
    assert.equal(analyze(source).outcome, 'pass');
  }
});

test('truncated image extraction discloses coverage whether an issue was found or not', () => {
  const absent = analyze('<img src="x" alt="">'.repeat(5001));
  assert.equal(absent.outcome, 'not-checked');
  assert.equal(absent.complete, false);
  assert.equal(absent.details.total, 5001);
  const found = analyze('<img src="first">' + '<img src="x" alt="">'.repeat(5000));
  assert.equal(found.outcome, 'fail');
  assert.equal(found.complete, false);
  assert.equal(found.details.examined, 5000);
});
