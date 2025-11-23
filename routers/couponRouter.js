const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const couponController = require("../controllers/couponController");

router.post("/api/v1/coupons", auth, couponController.addCoupon);
router.put("/api/v1/coupons/:couponId", auth, couponController.updateCoupon);
router.delete("/api/v1/coupons/:couponId", auth, couponController.deleteCoupon);
router.get("/api/v1/coupons", auth, couponController.getAllCoupons);

// Tra cứu mã giảm giá
router.get("/api/v1/check-coupon", couponController.checkCoupon);

module.exports = router;