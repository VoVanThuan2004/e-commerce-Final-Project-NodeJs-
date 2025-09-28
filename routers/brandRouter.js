const brandController = require('../controllers/brandController');
const auth = require('../middlewares/auth');
const express = require('express');
const router = express.Router();
const storage = require("../config/storage");
const multer = require("multer");
const upload = multer({ storage });

// API thêm thương hiệu
router.post('/api/v1/brands', upload.single("logo"), auth, brandController.createBrand);

// API lấy ra danh sách thương hiệu
router.get('/api/v1/brands', brandController.getAllBrands);

router.put('/api/v1/brands/:brandId', upload.single("logo"), auth, brandController.updateBrand);

router.delete('/api/v1/brands/:brandId', auth, brandController.deleteBrand);

module.exports = router;