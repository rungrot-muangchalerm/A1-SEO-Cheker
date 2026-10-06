const express = require('express');
const router = express.Router();

router.use('/audits', require('./audit/audit.routes.js'));

module.exports = router;
