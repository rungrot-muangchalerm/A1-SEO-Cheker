const express = require('express');
const router = express.Router();

router.use('/user', require('./user/user.routes.js'));

module.exports = router;
