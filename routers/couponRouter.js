const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const couponController = require("../controllers/couponController");

router.post("/api/v1/coupons/", auth, couponController.addCoupon);
router.put("/api/v1/coupons/:couponId", auth, couponController.updateCoupon);
router.delete("/api/v1/coupons/:couponId", auth, couponController.deleteCoupon);

module.exports = router;