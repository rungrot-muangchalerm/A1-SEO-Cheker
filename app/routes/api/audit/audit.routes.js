const express = require('express');
const audit = require('../../../controller/audit.controller');
const router = express.Router();

router.post('/', audit.create);

module.exports = router;
