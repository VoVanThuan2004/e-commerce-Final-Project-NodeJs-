const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const reviewController = require("../controllers/reviewController");
const storage = require("../config/storage");
const multer = require("multer");
const upload = multer({ storage });

// API thêm đánh giá
router.post("/api/v1/reviews/", upload.array("images"), reviewController.postReview);

// API lấy đánh giá của 1 sản phẩm
router.get("/api/v1/reviews/:productId", reviewController.getAllReviewsByProduct);

// API xóa đánh giá - admin
router.delete("/api/v1/reviews/:reviewId", auth, reviewController.deleteReview);

module.exports = router;