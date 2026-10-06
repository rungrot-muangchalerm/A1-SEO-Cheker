const test = require('node:test');
const assert = require('node:assert/strict');
const htmlService = require('../../app/service/html.service');
const website = require('../../app/data/website.data');
const auditService = require('../../app/service/audit.service');
const { stubTransport } = require('./helpers/transport');

const parse = (html) => htmlService.parse({ html, finalUrl: 'https://site.example/folder/page' });

test('extracts case-insensitive metadata, headings, canonical, links and images', () => {
  const data = parse('<!doctype html><html lang="th"><head><title> A &amp; B </title><meta NAME="DESCRIPTION" content=" Useful page "><base href="/assets/"><link REL="alternate CANONICAL" href="../main"></head><body><h1>Main <span>heading</span></h1><h2>Details</h2><a href="next?version=2#part">Next</a><img src="photo.png" alt=""><img src="missing.png"><svg><title>Not the page title</title></svg></body></html>');
  assert.equal(data.title, 'A & B');
  assert.equal(data.titles.length, 1);
  assert.equal(data.description, 'Useful page');
  assert.equal(data.lang, 'th');
  assert.equal(data.baseUrl, 'https://site.example/assets/');
  assert.equal(data.canonical[0].url, 'https://site.example/main');
  assert.deepEqual(data.headings.map(({ level, value }) => ({ level, value })), [
    { level: 1, value: 'Main heading' }, { level: 2, value: 'Details' }
  ]);
  assert.equal(data.links[0].url, 'https://site.example/assets/next?version=2#part');
  assert.equal(data.images[0].alt, '');
  assert.equal(data.images[0].hasAlt, true);
  assert.equal(data.images[1].alt, null);
  assert.equal(data.images[1].hasAlt, false);
  assert.equal(data.images[0].url, 'https://site.example/assets/photo.png');
});

test('preserves conflicting metadata and handles invalid URLs without fetching them', () => {
  const data = parse('<title>First</title><title>Second</title><meta name="description" content="one"><meta name="description" content="two"><link rel="canonical" href="http://["><link rel="canonical" href="/two"><body><a href="javascript:alert(1)">JS</a><a href="mailto:test@example.com">Mail</a><script>globalThis.__parserScriptExecuted=true;</script>');
  assert.equal(data.titles.length, 2);
  assert.equal(data.descriptions.length, 2);
  assert.equal(data.canonical.length, 2);
  assert.equal(data.canonical[0].url, null);
  assert.equal(data.canonical[1].url, 'https://site.example/two');
  assert.equal(data.links[0].url, null);
  assert.equal(data.links[1].url, null);
  assert.equal(globalThis.__parserScriptExecuted, undefined);
});

test('reads robots tags in the body and does not invent absent tags', () => {
  const data = parse('<body><meta name="GOOGLEBOT" content="noindex"><h1>Page</h1></body>');
  assert.equal(data.meta[0].name, 'googlebot');
  assert.equal(data.title, '');
  assert.equal(data.description, '');
  assert.deepEqual(data.canonical, []);
});

test('bounds extracted elements and evidence while disclosing truncation', () => {
  const data = parse('<a href="/long" data-extra="' + 'x'.repeat(5000) + '">Long</a>' + '<img src="x">'.repeat(5001));
  assert.equal(data.images.length, 5000);
  assert.equal(data.counts.images, 5001);
  assert.deepEqual(data.truncated, ['images']);
  assert.equal(data.links[0].source.length, 4096);
  assert.equal(data.links[0].sourceTruncated, true);
});

test('actual service response contains metadata extracted from fetched bytes', async (t) => {
  stubTransport(t, [
    { html: '<title>Fetched title</title><meta name="description" content="Fetched description"><h1>Fetched heading</h1>' },
    { status: 404 }
  ]);
  const result = await auditService.create({ url: 'https://page.example/' });
  assert.equal(result.ok, true);
  assert.equal(result.data.pages[0].metadata.title, 'Fetched title');
  assert.equal(result.data.pages[0].metadata.description, 'Fetched description');
  assert.equal(result.data.pages[0].metadata.headings[0].value, 'Fetched heading');
  assert.equal(result.data.status, 'partial');
});

test('HTML locations point into fetched bytes before serialization, including CRLF and repeated elements', () => {
  const html = '<!doctype html>\r\n<html><head>\r\n<TITLE> A &amp; B </TITLE>\r\n</head><body>\r\n<img src=first>\r\n<img src="second">\r\n</body></html>';
  const data = parse(html);
  assert.equal(data.titles[0].location.startLine, 3);
  assert.equal(data.images[0].location.startLine, 5);
  assert.equal(data.images[1].location.startLine, 6);
  assert.equal(data.images[1].location.startColumn, 1);
  const position = data.images[0].location;
  assert.equal(html.slice(position.startOffset, position.endOffset), '<img src=first>');
  assert.equal(data.images[0].source, '<img src="first">');
  assert.equal(data.images[0].location.endLine, 5);
  assert.equal(parse('\n' + html).images[0].location.startLine, 6);
});
