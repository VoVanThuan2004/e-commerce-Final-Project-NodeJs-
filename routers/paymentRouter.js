const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

router.get("/api/v1/vnpay/return", paymentController.vnpayReturn);

module.exports = router;
