const auth = require('../middlewares/auth');
const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');

// API thêm địa chỉ
router.post('/api/v1/addresses/', auth, addressController.createAddress); 
// API cập nhật địa chỉ
router.put('/api/v1/addresses/:addressId', auth, addressController.updateAddress); 
// API xóa địa chỉ
router.delete('/api/v1/addresses/:addressId', auth, addressController.deleteAddress);   
// API lấy tất cả địa chỉ của user
router.get('/api/v1/addresses/', auth, addressController.getAllAddresses);
// API cài đặt địa chỉ mặc định/api/v1/addressesh
router.put('/api/v1/addresses/set-default/:addressId', auth, addressController.setDefaultAddress);

module.exports = router;