const model = require('../model/audit.model');

module.exports = {
  only: (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    let host;
    try { host = new URL('http://' + req.get('host')); } catch {}
    if (!host || host.username || host.password || !['localhost', '127.0.0.1'].includes(host.hostname) ||
      Number(host.port || 80) !== req.socket.localPort || host.pathname !== '/' || host.search || host.hash) {
      return res.status(403).json({ schemaVersion: model.version, status: 'failed', error: 'LOCAL_HOST_REQUIRED', message: 'Local access only.' });
    }
    if (req.path === '/api/audits' && req.method === 'POST') {
      const origin = req.get('origin');
      if ((origin && origin !== host.origin) || req.get('sec-fetch-site') === 'cross-site') {
        return res.status(403).json({ schemaVersion: model.version, status: 'failed', error: 'LOCAL_ORIGIN_REQUIRED', message: 'Local origin required.' });
      }
      if (!req.is('application/json')) {
        return res.status(415).json({ schemaVersion: model.version, status: 'failed', error: 'JSON_REQUIRED', message: 'JSON request required.' });
      }
    }
    next();
  }
};
