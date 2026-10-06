const auditService = require('../service/audit.service');
const auditModel = require('../model/audit.model');
const { once } = require('node:events');

module.exports = {
  create: async (req, res) => {
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.set('Cache-Control', 'no-store');
    res.once('close', disconnected);
    const stream = req.headers?.accept?.includes('application/x-ndjson') && req.accepts('application/x-ndjson');
    const frame = async (type, data) => {
      if (controller.signal.aborted || res.destroyed) return;
      if (!res.headersSent) {
        res.status(200).set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
      }
      if (!res.write(JSON.stringify({ type, data }) + '\n')) await once(res, 'drain', { signal: controller.signal });
    };
    const respond = async (status, data) => {
      if (stream && (status === 200 || res.headersSent)) {
        await frame(data.status === 'failed' ? 'error' : 'report', data);
        if (!res.destroyed) res.end();
        return;
      }
      return res.status(status).json(data);
    };
    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ?
        { discover: true, crawl: true, render: true, lighthouse: true, ...req.body } : req.body;
      const result = await auditService.create(body, { signal: controller.signal, checkerPort: req.socket?.localPort,
        ...(stream ? { onProgress: (progress) => frame('progress', progress) } : {}) });
      if (controller.signal.aborted || res.destroyed) return;
      if (!result.ok) {
        if (result.code === 'CHECKER_TARGET') {
          return await respond(400, { schemaVersion: auditModel.version, status: 'failed', error: result.code,
            message: '\u0e01\u0e23\u0e38\u0e13\u0e32\u0e43\u0e0a\u0e49\u0e1e\u0e2d\u0e23\u0e4c\u0e15\u0e02\u0e2d\u0e07\u0e40\u0e27\u0e47\u0e1a\u0e17\u0e35\u0e48\u0e08\u0e30\u0e15\u0e23\u0e27\u0e08 \u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e1e\u0e2d\u0e23\u0e4c\u0e15 SEO Checker' });
        }
        if (result.code === 'CRAWL_DEADLINE') {
          return await respond(504, { schemaVersion: auditModel.version, status: 'failed', error: result.code,
            message: '\u0e16\u0e36\u0e07\u0e40\u0e27\u0e25\u0e32\u0e2a\u0e39\u0e07\u0e2a\u0e38\u0e14\u0e02\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08 \u0e01\u0e48\u0e2d\u0e19\u0e2d\u0e48\u0e32\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e23\u0e01\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' });
        }
        if (['ROBOTS_BLOCKED', 'ROBOTS_UNKNOWN'].includes(result.code)) {
          return await respond(422, { schemaVersion: auditModel.version, status: 'failed', error: result.code,
            message: result.code === 'ROBOTS_BLOCKED' ? 'robots.txt \u0e44\u0e21\u0e48\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15 SEOChecker \u0e2d\u0e48\u0e32\u0e19 URL \u0e19\u0e35\u0e49' : '\u0e22\u0e31\u0e07\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e01\u0e0e robots.txt \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u0e08\u0e36\u0e07\u0e44\u0e21\u0e48\u0e40\u0e23\u0e34\u0e48\u0e21 crawl' });
        }
        if (result.code === 'INTERNAL_ERROR') {
          return await respond(500, { schemaVersion: auditModel.version, status: 'failed', error: 'INTERNAL_ERROR', message: '\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' });
        }
        if (['INVALID_URL', 'URL_CREDENTIALS', 'PORT_NOT_ALLOWED', 'PRIVATE_TARGET'].includes(result.code)) {
          return await respond(400, { schemaVersion: auditModel.version, status: 'failed', error: result.code,
            message: 'URL HTTP/HTTPS: localhost, 127.0.0.1, [::1] \u0e2b\u0e23\u0e37\u0e2d\u0e40\u0e27\u0e47\u0e1a\u0e2a\u0e32\u0e18\u0e32\u0e23\u0e13\u0e30\u0e1e\u0e2d\u0e23\u0e4c\u0e15 80/443 \u0e42\u0e14\u0e22\u0e44\u0e21\u0e48\u0e43\u0e2a\u0e48\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19' });
        }
        if (result.code === 'TIMEOUT') {
          return await respond(504, { schemaVersion: auditModel.version, status: 'failed', error: result.code, message: '\u0e40\u0e27\u0e47\u0e1a\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32\u0e19\u0e32\u0e19\u0e40\u0e01\u0e34\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14' });
        }
        if (result.code === 'RESPONSE_TOO_LARGE') {
          return await respond(413, { schemaVersion: auditModel.version, status: 'failed', error: result.code, message: 'HTML \u0e21\u0e35\u0e02\u0e19\u0e32\u0e14\u0e40\u0e01\u0e34\u0e19\u0e02\u0e49\u0e2d\u0e08\u0e33\u0e01\u0e31\u0e14' });
        }
        if (['UNSUPPORTED_TYPE', 'UNSUPPORTED_ENCODING', 'UNSUPPORTED_CHARSET'].includes(result.code)) {
          return await respond(422, { schemaVersion: auditModel.version, status: 'failed', error: result.code, message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a\u0e0a\u0e19\u0e34\u0e14\u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32\u0e23\u0e2b\u0e31\u0e2a\u0e02\u0e2d\u0e07\u0e44\u0e1f\u0e25\u0e4c\u0e19\u0e35\u0e49' });
        }
        return await respond(502, { schemaVersion: auditModel.version, status: 'failed', error: result.code, message: '\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e40\u0e27\u0e47\u0e1a\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' });
      }
      return await respond(200, result.data);
    } catch {
      if (!controller.signal.aborted && !res.destroyed) {
        return await respond(500, { schemaVersion: auditModel.version, status: 'failed', error: 'INTERNAL_ERROR', message: '\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' });
      }
    } finally {
      res.removeListener('close', disconnected);
      req.releaseAuditSlot?.();
      delete req.releaseAuditSlot;
    }
  }
};
