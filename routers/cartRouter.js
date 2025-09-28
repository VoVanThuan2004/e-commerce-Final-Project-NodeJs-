const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

// Thêm sản phẩm vào giỏ hàng
router.post("/api/v1/cart", cartController.addToCart);

// Xóa sản phẩm ra khỏi giỏ hàng
router.delete("/api/v1/cart/:cartItemId", cartController.deleteToCart);

// Cập nhật số lượng item trong giỏ hàng

module.exports = router;