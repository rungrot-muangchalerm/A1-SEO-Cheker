const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');

module.exports = function setupLiveReload(app) {
  if (process.env.LIVERELOAD !== 'true') return;

  const clients = new Set();
  const version = crypto.randomBytes(16).toString('hex');
  const endpoint = '/__dev/livereload';
  const snippet = `<script>(() => {
    const events = new EventSource('${endpoint}');
    const version = '${version}';
    let reloading = false;
    const reload = () => {
      if (reloading) return;
      reloading = true;
      events.close();
      location.reload();
    };
    events.addEventListener('ready', (event) => {
      if (version !== event.data) reload();
    });
    events.addEventListener('reload', reload);
    window.addEventListener('pagehide', () => {
      events.close();
    });
  })();</script>`;

  app.get(endpoint, (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(`event: ready\ndata: ${version}\n\n`);
    clients.add(res);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
    res.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  });

  // EJS rendering uses res.send; leave JSON and other responses untouched.
  app.use((req, res, next) => {
    const send = res.send;
    res.send = function (body) {
      const contentType = res.getHeader('Content-Type');
      // Express assigns text/html inside send when a string has no explicit type.
      if (typeof body === 'string' && (!contentType || /text\/html/i.test(contentType)) && /<\/body>/i.test(body)) {
        body = body.replace(/<\/body>/i, () => snippet + '</body>');
        res.removeHeader('ETag');
      }
      return send.call(this, body);
    };
    next();
  });

  const root = path.join(__dirname, '..');
  let reloadTimer;
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: /(^|[\\/])(node_modules|\.git)([\\/]|$)/,
  });
  watcher.on('all', (event, file) => {
    if (!['add', 'change', 'unlink'].includes(event)) return;
    const relative = path.relative(root, file);
    const isClientFile = /^(assets|views)[\\/]/.test(relative);
    // Server changes reload through the new process's ready event.
    // Sending reload from the old process can navigate while nodemon is restarting.
    if (!isClientFile) {
      clearTimeout(reloadTimer);
      return;
    }
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const client of clients) client.write('event: reload\ndata: changed\n\n');
    }, 5);
  });
  watcher.on('error', error => console.error('LiveReload watcher:', error));
  console.log(`LiveReload enabled via SSE at ${endpoint}`);
  return watcher;
};
