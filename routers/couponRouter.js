const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const couponController = require("../controllers/couponController");

router.post("/api/v1/coupons", auth, couponController.addCoupon);
router.put("/api/v1/coupons/:couponId", auth, couponController.updateCoupon);
router.delete("/api/v1/coupons/:couponId", auth, couponController.deleteCoupon);
router.get("/api/v1/coupons", auth, couponController.getAllCoupons);

// API check coupon có hợp lệ
router.get("/api/v1/check-coupon", couponController.checkCoupon);

// API lấy danh sách đơn hàng đã áp dụng coupon
router.get("/api/v1/coupons/:couponId/applied", auth, couponController.getAllOrdersAppliedCoupon);

module.exports = router;