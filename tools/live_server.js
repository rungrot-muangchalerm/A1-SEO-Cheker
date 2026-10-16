const path = require('path');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');

module.exports = function setupLiveReload(app) {
  if (process.env.LIVERELOAD === 'true') {
    const server = livereload.createServer({
      port: 35729,
      host: '127.0.0.1',
      exts: ['ejs', 'js', 'css', 'json'],
      noListen: true,
    });
    const maxPort = server.config.port + 99;
    const ready = new Promise((resolve) => {
      server.on('error', (error) => {
        if ((error.code === 'EADDRINUSE' || error.code === 'EACCES') && server.config.port < maxPort) {
          server.config.port += 1;
          // Reuse the HTTP server so retries do not create extra WebSocket servers.
          server.config.server.listen(server.config.port, server.config.host);
          return;
        }

        console.error('LiveReload disabled:', error);
        server.close();
        resolve(null);
      });

      server.listen(() => {
        const port = server.config.server.address().port;
        server.watch([path.join(__dirname, '../')]);
        console.log(`LiveReload listening at http://127.0.0.1:${port}`);
        resolve(connectLivereload({ port, hostname: '127.0.0.1' }));
      });
    });

    // Wait for the selected port before injecting the script into a response.
    app.use((req, res, next) => {
      ready.then((middleware) => {
        if (middleware) {
          middleware(req, res, next);
          return;
        }
        next();
      }).catch(next);
    });

    return server;
  }
};
