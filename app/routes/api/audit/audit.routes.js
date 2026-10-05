const express = require('express');
const audit = require('../../../controller/audit.controller');
const auditMiddleware = require('../../../middleware/audit.middleware');
const router = express.Router();

router.use(auditMiddleware.headers);
router.post('/', audit.create);

module.exports = router;
