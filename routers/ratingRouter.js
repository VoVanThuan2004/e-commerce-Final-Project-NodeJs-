const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const ratingController = require("../controllers/ratingController");

// API đánh giá sao
router.post("/api/v1/ratings/", auth, ratingController.postRatingProduct);

// API lấy danh sách đánh giá sao
router.get("/api/v1/ratings/:productId", ratingController.getAllRatingsByProduct);

// API trả về tổng số lượng đánh giá cho từng số sao tương ứng
router.get("/api/v1/ratings/:productId/summary", ratingController.getSummaryRatingForProduct);

module.exports = router;