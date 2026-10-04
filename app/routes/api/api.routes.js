const express = require('express');
const router = express.Router();

router.use('/user', require('./user/user.routes.js'));
router.use('/audits', require('./audit/audit.routes.js'));

module.exports = router;
