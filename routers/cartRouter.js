const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

// Thêm sản phẩm vào giỏ hàng
router.post("/api/v1/cart", cartController.addToCart);

// Xóa sản phẩm ra khỏi giỏ hàng
router.delete("/api/v1/cart/:cartItemId", cartController.deleteToCart);

// Cập nhật số lượng item trong giỏ hàng
router.put("/api/v1/cart/quantity/:cartItemId", cartController.updateQuantityCartItem);

// Lấy ra thông tin giỏ hàng
router.get("/api/v1/cart", cartController.getCart);

module.exports = router;