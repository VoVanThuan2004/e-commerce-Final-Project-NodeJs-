const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const userController = require('../controllers/userController');
const storage = require('../config/storage');
const multer = require('multer');
const upload = multer({ storage });

// Lấy danh sách người dùng
router.get('/api/v1/users', auth, userController.getAllUsers);

// Cập nhật thông tin người dùng
router.put('/api/v1/users', auth, upload.single("avatar"), userController.updateUser);

// Lấy thông tin profile
router.get('/api/v1/users/profile', auth, userController.getUserProfile);

// Cập nhật thông tin người dùng dành cho admin
router.put('/api/v1/admin/users/:userId', auth, upload.single("avatar"), userController.updateUserByAdmin);

// Lấy số điểm tích lũy hiện tại của người dùng
router.get('/api/v1/users/loyalty-points', auth, userController.getLoyaltyPoints);


module.exports = router;
