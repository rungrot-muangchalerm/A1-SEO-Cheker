const model = require('../model/audit.model');

const limits = Object.freeze({ maxConcurrent: 2, maxStarts: 10, windowMs: 10000 });

module.exports = {
  limits,
  create: () => {
    let active = 0;
    let starts = 0;
    let windowStarted = Date.now();
    return (req, res, next) => {
      if (req.method !== 'POST' || !/^\/api\/audits\/?$/i.test(req.path)) return next();
      res.set('Cache-Control', 'no-store');
      const now = Date.now();
      if (now < windowStarted || now - windowStarted >= limits.windowMs) {
        starts = 0;
        windowStarted = now;
      }
      if (active >= limits.maxConcurrent) {
        return res.status(503).set('Retry-After', '1').json({
          schemaVersion: model.version, status: 'failed',
          error: 'AUDIT_BUSY', message: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e04\u0e23\u0e1a 2 \u0e23\u0e2d\u0e1a \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e43\u0e2b\u0e49\u0e07\u0e32\u0e19\u0e40\u0e14\u0e34\u0e21\u0e2a\u0e34\u0e49\u0e19\u0e2a\u0e38\u0e14\u0e41\u0e25\u0e49\u0e27\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48'
        });
      }
      if (starts >= limits.maxStarts) {
        return res.status(429).set('Retry-After', String(Math.max(1, Math.ceil((limits.windowMs - (now - windowStarted)) / 1000))))
          .json({ schemaVersion: model.version, status: 'failed', error: 'AUDIT_RATE_LIMIT', message: '\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e23\u0e27\u0e08\u0e16\u0e35\u0e48\u0e40\u0e01\u0e34\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d 10 \u0e27\u0e34\u0e19\u0e32\u0e17\u0e35\u0e41\u0e25\u0e49\u0e27\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48' });
      }
      active += 1;
      starts += 1;
      let released = false;
      // A disconnected browser may still be cleaning up; the controller releases after its service settles.
      req.releaseAuditSlot = () => {
        if (!released) { released = true; active -= 1; }
      };
      next();
    };
  }
};
