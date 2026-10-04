const express = require("express");
const frontendController = require("../../controller/frontend.controller");
const router = express.Router();

router.get("/", frontendController.index);

module.exports = router;
