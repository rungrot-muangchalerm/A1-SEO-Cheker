const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns/promises');
const net = require('node:net');
const { MIMEType } = require('node:util');
const ipaddr = require('ipaddr.js');
const zlib = require('node:zlib');
const sniffEncoding = require('html-encoding-sniffer');

const limits = Object.freeze({ timeoutMs: 15000, maxBytes: 2 * 1024 * 1024, maxRedirects: 5 });
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

class WebsiteError extends Error {
  constructor(code) {
    super(code);
    this.name = 'WebsiteError';
    this.code = code;
  }
}

function failure(code) {
  return new WebsiteError(code);
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
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.range() !== 'unicast') return false;
    return parsed.kind() === 'ipv4' || parsed.match(ipaddr.parse('2000::'), 3);
  } catch { return false; }
}

function withSignal(promise, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      signal.removeEventListener('abort', aborted);
      reject(signal.reason || failure('CANCELLED'));
    };
    if (signal.aborted) return aborted();
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

async function resolvePublicTarget(url, signal) {
  signal.throwIfAborted();
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

function requestPage(url, addresses, signal, maxBytes, kind = 'html') {
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
        Accept: kind === 'robots' ? 'text/plain, text/html;q=0.5' : kind === 'sitemap' ? 'application/xml, text/xml, application/*+xml;q=0.9' : 'text/html, application/xhtml+xml',
        'Accept-Encoding': 'identity'
      }
    }, (response) => {
      const status = response.statusCode;
      const headers = { ...response.headers };
      const observedFailure = (code) => Object.assign(failure(code), {
        observation: { url: url.href, status, headers, rawHeaders: response.rawHeaders || [] }
      });
      if (redirectStatuses.has(status)) {
        response.destroy();
        if (!headers.location) return reject(observedFailure('INVALID_REDIRECT'));
        return resolve({ status, headers, redirect: headers.location });
      }
      if (kind !== 'html' && (status < 200 || status >= 300)) {
        response.destroy();
        return resolve({ status, headers, rawHeaders: response.rawHeaders || [], text: '', encoding: 'UTF-8', bytes: 0, receivedBytes: 0 });
      }
      let mediaType;
      try { mediaType = new MIMEType(kind === 'robots' ? 'text/plain; charset=utf-8' : headers['content-type'] || ''); } catch {
        response.destroy();
        return reject(observedFailure('UNSUPPORTED_TYPE'));
      }
      const supportedType = kind === 'robots' || (kind === 'sitemap' ?
        ['application/xml', 'text/xml'].includes(mediaType.essence) || mediaType.essence.endsWith('+xml') :
        ['text/html', 'application/xhtml+xml'].includes(mediaType.essence));
      if (!supportedType) {
        response.destroy();
        return reject(observedFailure('UNSUPPORTED_TYPE'));
      }
      const encoding = String(headers['content-encoding'] || 'identity').trim().toLowerCase();
      if (!['identity', 'gzip', 'deflate', 'br'].includes(encoding)) {
        response.destroy();
        return reject(observedFailure('UNSUPPORTED_ENCODING'));
      }
      if (Number(headers['content-length']) > maxBytes) {
        response.destroy();
        return reject(observedFailure('RESPONSE_TOO_LARGE'));
      }
      const chunks = [];
      let size = 0;
      let receivedBytes = 0;
      let decoder;
      if (encoding === 'gzip') decoder = zlib.createGunzip();
      else if (encoding === 'deflate') decoder = zlib.createInflate();
      else if (encoding === 'br') decoder = zlib.createBrotliDecompress();
      const body = decoder || response;
      const stop = (code) => {
        reject(observedFailure(code));
        decoder?.destroy();
        response.destroy();
        request.destroy();
      };
      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBytes) stop('RESPONSE_TOO_LARGE');
      });
      body.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          stop('RESPONSE_TOO_LARGE');
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', () => reject(observedFailure(signal.aborted ? signal.reason.code : 'NETWORK_ERROR')));
      response.on('aborted', () => stop(signal.aborted ? signal.reason.code : 'NETWORK_ERROR'));
      decoder?.on('error', () => stop('DECOMPRESSION_FAILED'));
      body.on('end', () => {
        try {
          const charset = mediaType.params.get('charset');
          if (charset) new TextDecoder(charset);
          if (kind === 'sitemap' && charset && !['utf-8', 'utf8'].includes(charset.toLowerCase())) throw failure('UNSUPPORTED_CHARSET');
          const buffer = Buffer.concat(chunks);
          const encoding = kind !== 'html' ? 'UTF-8' : sniffEncoding(buffer, {
            transportLayerEncodingLabel: charset,
            defaultEncoding: mediaType.essence === 'application/xhtml+xml' ? 'UTF-8' : undefined
          });
          const content = new TextDecoder(encoding, { fatal: kind === 'sitemap' }).decode(buffer);
          resolve({
            status, headers, rawHeaders: response.rawHeaders || [],
            ...(kind !== 'html' ? { text: content } : { html: content }), encoding, bytes: size, receivedBytes
          });
        } catch { reject(observedFailure('UNSUPPORTED_CHARSET')); }
      });
      if (decoder) response.pipe(decoder);
    });
    request.on('error', () => reject(signal.aborted ? signal.reason : failure('NETWORK_ERROR')));
    request.end();
  });
}

async function fetchResource(value, options, kind) {
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason instanceof WebsiteError ? options.signal.reason : failure('CANCELLED'));
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(failure('TIMEOUT')), options.timeoutMs || limits.timeoutMs);
  const maxBytes = options.maxBytes || limits.maxBytes;
  const maxRedirects = options.maxRedirects ?? limits.maxRedirects;
  let requestedUrl;
  let lastObservation;
  const redirects = [];
  try {
    let url = parseUrl(value);
    requestedUrl = url.href;
    const seen = new Set();
    for (; ;) {
      controller.signal.throwIfAborted();
      if (options.scopeOrigin && url.origin !== options.scopeOrigin) throw failure('OUTSIDE_SCOPE');
      if (seen.has(url.href)) throw failure('REDIRECT_LOOP');
      seen.add(url.href);
      await options.beforeRequest?.(url, controller.signal);
      controller.signal.throwIfAborted();
      const addresses = await resolvePublicTarget(url, controller.signal);
      const result = await requestPage(url, addresses, controller.signal, maxBytes, kind);
      lastObservation = { url: url.href, status: result.status, headers: result.headers, rawHeaders: result.rawHeaders || [] };
      if (!result.redirect) return { requestedUrl, finalUrl: url.href, redirects, ...result };
      if (redirects.length >= maxRedirects) throw failure('TOO_MANY_REDIRECTS');
      let next;
      try { next = new URL(result.redirect, url); } catch { throw failure('INVALID_REDIRECT'); }
      redirects.push({ url: url.href, status: result.status, destination: next.href });
      url = parseUrl(next.href);
    }
  } catch (error) {
    const result = controller.signal.aborted ? controller.signal.reason : error;
    const observation = error.observation || lastObservation;
    if (result instanceof WebsiteError && observation && result.code !== 'CANCELLED') {
      result.observation = { ...observation, requestedUrl, redirects: [...redirects], terminal: !redirectStatuses.has(observation.status) };
    }
    throw result;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

module.exports = {
  limits, WebsiteError, parseUrl, isPublicIp, resolvePublicTarget, requestPage,
  fetchPage: (value, options = {}) => fetchResource(value, options, 'html'),
  fetchRobots: (value, options = {}) => fetchResource(value, {
    timeoutMs: 5000, maxBytes: 500 * 1024, maxRedirects: 5, ...options
  }, 'robots'),
  fetchSitemap: (value, options = {}) => fetchResource(value, {
    timeoutMs: 5000, maxBytes: 512 * 1024, maxRedirects: 5, ...options
  }, 'sitemap')
};
