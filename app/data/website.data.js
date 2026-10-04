const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns/promises');
const net = require('node:net');
const { MIMEType } = require('node:util');
const ipaddr = require('ipaddr.js');

const limits = Object.freeze({ timeoutMs: 15000, maxBytes: 2 * 1024 * 1024, maxRedirects: 5 });
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) throw failure('INVALID_URL');
  let url;
  try { url = new URL(value.trim()); } catch { throw failure('INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw failure('INVALID_URL');
  if (url.username || url.password) throw failure('URL_CREDENTIALS');
  if (url.port) throw failure('PORT_NOT_ALLOWED');
  url.hash = '';
  return url;
}

function isPublicIp(address) {
  try { return ipaddr.parse(address).range() === 'unicast'; } catch { return false; }
}

function withSignal(promise, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason || failure('CANCELLED'));
    if (signal.aborted) return aborted();
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

async function resolvePublicTarget(url, signal) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname, family: net.isIP(hostname) }];
  } else {
    try {
      addresses = await withSignal(dns.lookup(hostname, { all: true, verbatim: true }), signal);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      throw failure('DNS_FAILED');
    }
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw failure('PRIVATE_TARGET');
  }
  return addresses;
}

function requestPage(url, addresses, signal, maxBytes) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    // Pin the vetted DNS records to this socket so DNS cannot change between validation and connection.
    const request = transport.request(url, {
      agent: false,
      maxHeaderSize: 16384,
      signal,
      lookup: (_hostname, options, callback) => {
        if (options.all) return callback(null, addresses);
        const record = addresses.find((entry) => !options.family || entry.family === options.family) || addresses[0];
        callback(null, record.address, record.family);
      },
      headers: {
        'User-Agent': 'SEOChecker/0.1',
        Accept: 'text/html, application/xhtml+xml',
        'Accept-Encoding': 'identity'
      }
    }, (response) => {
      const status = response.statusCode;
      const headers = { ...response.headers };
      if (redirectStatuses.has(status)) {
        response.destroy();
        if (!headers.location) return reject(failure('INVALID_REDIRECT'));
        return resolve({ status, headers, redirect: headers.location });
      }
      let mediaType;
      try { mediaType = new MIMEType(headers['content-type'] || ''); } catch {
        response.destroy();
        return reject(failure('UNSUPPORTED_TYPE'));
      }
      if (!['text/html', 'application/xhtml+xml'].includes(mediaType.essence)) {
        response.destroy();
        return reject(failure('UNSUPPORTED_TYPE'));
      }
      if (headers['content-encoding'] && headers['content-encoding'] !== 'identity') {
        response.destroy();
        return reject(failure('UNSUPPORTED_ENCODING'));
      }
      if (Number(headers['content-length']) > maxBytes) {
        response.destroy();
        return reject(failure('RESPONSE_TOO_LARGE'));
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy();
          request.destroy();
          reject(failure('RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', () => reject(signal.aborted ? signal.reason : failure('NETWORK_ERROR')));
      response.on('end', () => {
        try {
          const html = new TextDecoder(mediaType.params.get('charset') || 'utf-8').decode(Buffer.concat(chunks));
          resolve({ status, headers, html, bytes: size });
        } catch { reject(failure('UNSUPPORTED_CHARSET')); }
      });
    });
    request.on('error', () => reject(signal.aborted ? signal.reason : failure('NETWORK_ERROR')));
    request.end();
  });
}

module.exports = {
  limits, parseUrl, isPublicIp, resolvePublicTarget, requestPage,
  fetchPage: async (value, options = {}) => {
    const controller = new AbortController();
    const cancel = () => controller.abort(failure('CANCELLED'));
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(failure('TIMEOUT')), options.timeoutMs || limits.timeoutMs);
    const maxBytes = options.maxBytes || limits.maxBytes;
    const maxRedirects = options.maxRedirects ?? limits.maxRedirects;
    try {
      let url = parseUrl(value);
      const requestedUrl = url.href;
      const redirects = [];
      const seen = new Set();
      for (;;) {
        controller.signal.throwIfAborted();
        if (seen.has(url.href)) throw failure('REDIRECT_LOOP');
        seen.add(url.href);
        const addresses = await resolvePublicTarget(url, controller.signal);
        const result = await requestPage(url, addresses, controller.signal, maxBytes);
        if (!result.redirect) return { requestedUrl, finalUrl: url.href, redirects, ...result };
        if (redirects.length >= maxRedirects) throw failure('TOO_MANY_REDIRECTS');
        let next;
        try { next = new URL(result.redirect, url); } catch { throw failure('INVALID_REDIRECT'); }
        redirects.push({ url: url.href, status: result.status, destination: next.href });
        url = parseUrl(next.href);
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
};
