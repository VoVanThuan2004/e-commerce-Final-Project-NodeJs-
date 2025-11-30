const express = require("express");
const router = express.Router();
const ghnController = require("../controllers/ghnController");

router.post("/api/v1/shipping-fee", ghnController.getShippingFee);

router.post("/api/v1/shipping-fee/test", ghnController.checkDistrict);

module.exports = router;