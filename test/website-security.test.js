const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns/promises');
const website = require('../app/data/website.data');
const { stubTransport } = require('./helpers/transport');

test('rejects non-HTTP URLs, credentials, non-default ports and invalid input', () => {
  for (const url of ['file:///secret', 'ftp://example.com', 'javascript:alert(1)', 'data:text/html,x', '//example.com', 'example.com', null, [], 1, 'x'.repeat(8193)]) {
    assert.throws(() => website.parseUrl(url), { code: 'INVALID_URL' });
  }
  assert.throws(() => website.parseUrl('https://name:password@example.com'), { code: 'URL_CREDENTIALS' });
  assert.throws(() => website.parseUrl('https://example.com:8443/'), { code: 'PORT_NOT_ALLOWED' });
  assert.equal(website.parseUrl(' https://example.com:443/a?key=1#heading ').href, 'https://example.com/a?key=1');
});

test('blocks private, local, reserved, multicast and IPv6 translation addresses', () => {
  for (const address of ['0.0.0.0', '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1', 'fe80::1', 'ff02::1', 'fec0::1', '2001:db8::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', '64:ff9b::a00:1', '100::1', 'garbage']) {
    assert.equal(website.isPublicIp(address), false, address);
  }
  assert.equal(website.isPublicIp('8.8.8.8'), true);
  assert.equal(website.isPublicIp('2606:4700:4700::1111'), true);
});

test('blocks alternate loopback URL spellings before opening a socket', async (t) => {
  const transport = stubTransport(t);
  for (const url of ['http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/']) {
    await assert.rejects(website.fetchPage(url), { code: 'PRIVATE_TARGET' });
  }
  assert.equal(transport.calls.length, 0);
});

test('rejects mixed public/private DNS records and handles DNS failures', async (t) => {
  const controller = new AbortController();
  t.mock.method(dns, 'lookup', async () => [
    { address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }
  ]);
  await assert.rejects(website.resolvePublicTarget(new URL('https://mixed.example'), controller.signal), { code: 'PRIVATE_TARGET' });
  t.mock.method(dns, 'lookup', async () => { throw new Error('Sensitive resolver detail'); });
  await assert.rejects(website.fetchPage('https://missing.example'), { code: 'DNS_FAILED' });
});

test('pins DNS to the socket and never sends cookies, authorization or proxy credentials', async (t) => {
  const transport = stubTransport(t, [{ html: '<title>Actual bytes</title>' }]);
  const result = await website.fetchPage('https://public.example/');
  const options = transport.calls[0].options;
  t.mock.method(dns, 'lookup', async () => [{ address: '127.0.0.1', family: 4 }]);
  const records = await new Promise((resolve, reject) => options.lookup('public.example', { all: true }, (error, value) => error ? reject(error) : resolve(value)));
  assert.deepEqual(records, [{ address: '93.184.216.34', family: 4 }]);
  const selected = await new Promise((resolve) => options.lookup('public.example', {}, (error, address, family) => resolve({ error, address, family })));
  assert.equal(selected.address, '93.184.216.34');
  assert.equal(selected.family, 4);
  assert.equal(transport.resolvers.length, 1);
  assert.equal(options.agent, false);
  assert.equal(options.rejectUnauthorized, undefined);
  assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Accept-Encoding', 'User-Agent']);
  assert.equal(result.html, '<title>Actual bytes</title>');
});

test('checks each redirect target including DNS changes for the same hostname', async (t) => {
  const transport = stubTransport(t, [{ status: 302, headers: { location: '/next' } }]);
  let lookupCount = 0;
  t.mock.method(dns, 'lookup', async () => [{ address: ++lookupCount === 1 ? '8.8.8.8' : '127.0.0.1', family: 4 }]);
  await assert.rejects(website.fetchPage('https://changing.example/'), { code: 'PRIVATE_TARGET' });
  assert.equal(transport.calls.length, 1);
});

test('cannot redirect to private IPs or a different protocol', async (t) => {
  const transport = stubTransport(t, [
    { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } },
    { status: 302, headers: { location: 'file:///secret' } }
  ]);
  await assert.rejects(website.fetchPage('https://public.example/'), { code: 'PRIVATE_TARGET' });
  await assert.rejects(website.fetchPage('https://public.example/'), { code: 'INVALID_URL' });
  assert.equal(transport.calls.length, 2);
});
