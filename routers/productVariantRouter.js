const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const productVariantController = require("../controllers/productVariantController");
const storage = require('../config/storage');
const multer = require('multer');
const upload = multer({ storage });

// API thêm biến thể sản phẩm
router.post("/api/v1/product-variant/", auth, upload.array('images'), productVariantController.addProductVariant);

// API cập nhật biến thể sản phẩm
router.put("/api/v1/product-variant/:productVariantId", auth, upload.array("images"), productVariantController.updateProductVariant);

// API xóa biến thể sản phẩm
router.delete("/api/v1/product-variant/:productVariantId", auth, productVariantController.deleteProductVariant);

// API cập nhật tồn kho
router.put("/api/v1/product-variant/:productVariantId/inventory", auth, productVariantController.updateInventory);

module.exports = router;