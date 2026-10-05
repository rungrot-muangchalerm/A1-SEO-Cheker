const auditModel = require('../model/audit.model');

module.exports = {
  headers: (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  error: (error, req, res, next) => {
    if (req.path !== '/api/audits' && !req.path.startsWith('/api/audits/')) return next(error);
    if (res.destroyed) return;
    if (res.headersSent) return res.destroy();
    res.set('Cache-Control', 'no-store');
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ schemaVersion: auditModel.version, status: 'failed', error: 'INVALID_JSON', message: 'Invalid JSON body.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ schemaVersion: auditModel.version, status: 'failed', error: 'BODY_TOO_LARGE', message: 'Request body is too large.' });
    }
    if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
      return res.status(415).json({ schemaVersion: auditModel.version, status: 'failed', error: 'UNSUPPORTED_REQUEST_ENCODING', message: 'Unsupported request encoding.' });
    }
    return res.status(500).json({ schemaVersion: auditModel.version, status: 'failed', error: 'INTERNAL_ERROR', message: 'Unable to complete this audit.' });
  }
};
