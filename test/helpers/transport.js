const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns/promises');

module.exports = {
  stubTransport: (t, responses = []) => {
    const calls = [];
    const connections = [];
    const resolvers = [];
    t.mock.method(dns, 'lookup', async (hostname) => {
      resolvers.push(hostname);
      return [{ address: '93.184.216.34', family: 4 }];
    });
    const request = (url, options, callback) => {
      const stream = new EventEmitter();
      let response;
      let timer;
      let aborted;
      stream.destroyed = false;
      stream.destroy = () => {
        stream.destroyed = true;
        clearTimeout(timer);
        options.signal.removeEventListener('abort', aborted);
        response?.destroy();
      };
      aborted = () => {
        stream.destroy();
        queueMicrotask(() => stream.emit('error', options.signal.reason));
      };
      stream.end = () => {
        if (options.signal.aborted) return aborted();
        options.signal.addEventListener('abort', aborted, { once: true });
        const item = responses[calls.length] || { html: '<title>Test</title>' };
        calls.push({ url: url.href, options });
        const send = () => {
          if (item.networkError) return stream.emit('error', new Error('Upstream private detail'));
          if (item.neverRespond) return;
          response = new PassThrough();
          response.statusCode = item.status || 200;
          response.headers = { 'content-type': 'text/html; charset=utf-8', ...item.headers };
          response.on('close', () => {
            options.signal.removeEventListener('abort', aborted);
            clearTimeout(timer);
          });
          callback(response);
          if (response.destroyed) return;
          if (item.streamError) return response.destroy(new Error('Truncated upstream'));
          if (item.chunks) { item.chunks.forEach((chunk) => response.write(chunk)); response.end(); }
          else response.end(item.html || '');
        };
        if (item.delay) timer = setTimeout(send, item.delay);
        else queueMicrotask(send);
      };
      connections.push(stream);
      return stream;
    };
    t.mock.method(http, 'request', request);
    t.mock.method(https, 'request', request);
    return { calls, connections, resolvers };
  }
};
