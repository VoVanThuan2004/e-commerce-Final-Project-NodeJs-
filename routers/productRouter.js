const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const auth = require("../middlewares/auth");
const storage = require("../config/storage");
const multer = require("multer");
const upload = multer({ storage });

// API thêm product
router.post(
  "/api/v1/products/",
  auth,
  upload.single("image"),
  productController.addProduct
);

// API cập nhật product
router.put(
  "/api/v1/products/:productId",
  auth,
  upload.single("image"),
  productController.updateProduct
);

// API xóa product
router.delete("/api/v1/products/:productId", auth, productController.deleteProduct);

// API tắt - bật sản phẩm
router.put("/api/v1/products/:productId/status", auth, productController.updateStatusProduct);

// API tìm kiếm
router.get("/api/v1/products/search/", productController.searchProduct);

// API gợi ý tìm kiếm
router.get("/api/v1/products/suggest/", productController.suggestProduct);

// API lọc sản phẩm
router.get("/api/v1/products/filter/", productController.filterProduct);

// API sắp xếp theo name - price
router.get("/api/v1/products/sort/", productController.sortProduct);

// API xem chi tiết sản phẩm
router.get("/api/v1/products/:productId/detail", productController.viewDetailProduct);

// API chọn sản phẩm biến thể
router.get("/api/v1/products/:productId/variants", productController.chooseProductVariant);

module.exports = router;
