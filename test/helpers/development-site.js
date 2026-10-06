const http = require('node:http');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cLagAAAAASUVORK5CYII=', 'base64');
function document(title, body, scripts = '') {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title><meta name="description" content="Local development audit fixture"><link rel="canonical" href="/">' +
    '<link rel="icon" href="/pixel.png"><link rel="stylesheet" href="/style.css"></head><body><main><h1>' + title + '</h1>' + body + '</main>' + scripts + '</body></html>';
}

module.exports = {
  document,
  start: async (t, options = {}) => {
    const requests = [];
    let origin;
    const routes = new Map(Object.entries(options.routes || {}));
    const server = http.createServer((req, res) => {
      requests.push({ path: req.url, method: req.method, headers: req.headers });
      if (routes.has(req.url)) return routes.get(req.url)(req, res);
      if (req.url === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /protected\n'); }
      if (req.url === '/sitemap.xml') {
        res.writeHead(200, { 'content-type': 'application/xml' });
        return res.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '/sitemap-only</loc></url></urlset>');
      }
      if (req.url === '/style.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end('body{font:16px Arial,sans-serif;color:#164e63;background:#cffafe}main{padding:24px}'); }
      if (req.url === '/pixel.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(png); }
      res.writeHead(req.url === '/missing' ? 404 : 200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(document(req.url === '/' ? (options.title || 'Development fixture') : req.url,
        req.url === '/' ? '<p>A native local website for SEO verification.</p><a href="/child">Child</a><a href="/missing">Missing</a><img src="/pixel.png" alt="Fixture image" width="20" height="20">' : '<p>Local page content.</p>', options.scripts || ''));
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, options.host || '127.0.0.1', resolve); });
    origin = 'http://' + (options.host === '::1' ? '[::1]' : 'localhost') + ':' + server.address().port;
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    return { server, origin, routes, requests };
  }
};
