const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const userController = require('../controllers/userController');
const storage = require('../config/storage');
const multer = require('multer');
const upload = multer({ storage });

// Đăng nhập (email + password)
router.post('/api/v1/auth/login', userController.login);

// Đăng nhập bằng tài khoản Google
router.post('/api/v1/auth/login/social-account', userController.loginSocialAccount);

// Đăng ký tài khoản
router.post('/api/v1/auth/register', userController.register);

// Nhận mã otp khi đăng ký tài khoản
router.post('/api/v1/auth/verify/create-account', userController.verifyOTPCreateAccount);

// Khóa tài khoản
router.put('/api/v1/auth/active-account/:userId', auth, userController.activeAccount);

// Khôi phục mật khẩu
router.post('/api/v1/auth/recovery-password', userController.recoveryPassword);

// Xác thực mã otp cho khôi phục mật khẩu
router.post('/api/v1/auth/verify/recovery-password', userController.verifyOTPRecoveryPassword);

// Thay đổi mật khẩu
router.put('/api/v1/auth/change-password', auth, userController.changePassword);

// RefreshToken
router.post('/api/v1/auth/refreshToken', userController.refreshToken);

// Set password cho tài khoản mới (guest)
router.post('/api/v1/auth/set-password', userController.setPassword);


// Lấy danh sách người dùng
router.get('/api/v1/users', auth, userController.getAllUsers);

// Cập nhật thông tin người dùng
router.put('/api/v1/users', auth, upload.single("avatar"), userController.updateUser);

// Lấy thông tin profile
router.get('/api/v1/users/profile', auth, userController.getUserProfile);

// Cập nhật thông tin người dùng dành cho admin
router.put('/api/v1/admin/users/:userId', auth, upload.single("avatar"), userController.updateUserByAdmin);

// Đăng xuất 
router.post('/api/v1/auth/logout', userController.logout);

module.exports = router;
