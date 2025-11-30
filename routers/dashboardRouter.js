const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const auth = require("../middlewares/auth");

router.get("/api/v1/dashboard/basic", auth, dashboardController.getDashboardBasic);
router.get("/api/v1/dashboard/advanced", auth, dashboardController.getDashboardAdvanced);

module.exports = router;