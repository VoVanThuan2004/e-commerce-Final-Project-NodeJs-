const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const wishListController = require("../controllers/wishListController");

// API thêm sản phẩm vào danh sách yêu thích, có thể kết hợp với gỡ sp ra khỏi danh sách
router.post("/api/v1/wishlist/", auth, wishListController.addToWishlist);

// API xóa sản phẩm khỏi danh sách yêu thích
router.delete("/api/v1/wishlist/:productId", auth, wishListController.deleteProductOutWishList);

// API lấy ra danh sách sản phẩm trong wish list
router.get("/api/v1/wishlist/", auth, wishListController.getAllProductsInWishList);

// API check sản phẩm có trong wishlist chưa
router.get("/api/v1/check-wishlist/:productId", auth, wishListController.checkWishList); 

module.exports = router;