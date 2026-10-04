const express = require("express");
const frontendController = require("../controller/frontend.controller");
const router = express.Router();

router.use("/api", require("./api/api.routes"));
router.use(require("./frontend/frontend.routes"));
router.use(frontendController.notFound);

module.exports = router;
