const brandController = require('../controllers/brandController');
const auth = require('../middlewares/auth');
const express = require('express');
const router = express.Router();

// API thêm thương hiệu
router.post('/api/v1/brands', auth, brandController.createBrand);

// API lấy ra danh sách thương hiệu
router.get('/api/v1/brands', brandController.getAllBrands);

router.put('/api/v1/brands/:brandId', auth, brandController.updateBrand);

module.exports = router;