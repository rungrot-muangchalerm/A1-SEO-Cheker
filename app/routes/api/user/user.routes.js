const express = require('express');
const router = express.Router();
const demo = require('../../../controller/demo.controller.js');

router.get('/get-demo', demo.getDemo);

module.exports = router;
