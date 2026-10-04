const auditService = require('../service/audit.service');

module.exports = {
  create: async (req, res) => {
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.set('Cache-Control', 'no-store');
    res.once('close', disconnected);
    try {
      const result = await auditService.create(req.body, { signal: controller.signal });
      if (controller.signal.aborted || res.destroyed) return;
      if (!result.ok) {
        if (['INVALID_URL', 'URL_CREDENTIALS', 'PORT_NOT_ALLOWED', 'PRIVATE_TARGET'].includes(result.code)) {
          return res.status(400).json({ error: result.code, message: '\u0e01\u0e23\u0e38\u0e13\u0e32\u0e43\u0e0a\u0e49 URL HTTP/HTTPS \u0e2a\u0e32\u0e18\u0e32\u0e23\u0e13\u0e30 \u0e1e\u0e2d\u0e23\u0e4c\u0e15 80 \u0e2b\u0e23\u0e37\u0e2d 443 \u0e42\u0e14\u0e22\u0e44\u0e21\u0e48\u0e43\u0e2a\u0e48\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e48\u0e32\u0e19' });
        }
        if (result.code === 'TIMEOUT') {
          return res.status(504).json({ error: result.code, message: '\u0e40\u0e27\u0e47\u0e1a\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32\u0e19\u0e32\u0e19\u0e40\u0e01\u0e34\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14' });
        }
        if (result.code === 'RESPONSE_TOO_LARGE') {
          return res.status(413).json({ error: result.code, message: 'HTML \u0e21\u0e35\u0e02\u0e19\u0e32\u0e14\u0e40\u0e01\u0e34\u0e19\u0e02\u0e49\u0e2d\u0e08\u0e33\u0e01\u0e31\u0e14' });
        }
        if (['UNSUPPORTED_TYPE', 'UNSUPPORTED_ENCODING', 'UNSUPPORTED_CHARSET'].includes(result.code)) {
          return res.status(422).json({ error: result.code, message: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a\u0e0a\u0e19\u0e34\u0e14\u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32\u0e23\u0e2b\u0e31\u0e2a\u0e02\u0e2d\u0e07\u0e44\u0e1f\u0e25\u0e4c\u0e19\u0e35\u0e49' });
        }
        return res.status(502).json({ error: result.code, message: '\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01\u0e40\u0e27\u0e47\u0e1a\u0e1b\u0e25\u0e32\u0e22\u0e17\u0e32\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' });
      }
      return res.status(200).json(result.data);
    } catch {
      if (!controller.signal.aborted && !res.destroyed) {
        return res.status(500).json({ error: 'INTERNAL_ERROR', message: '\u0e15\u0e23\u0e27\u0e08\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08' });
      }
    } finally {
      res.removeListener('close', disconnected);
    }
  }
};
