const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const authController = require('../controllers/authController');


// Đăng nhập (email + password)
router.post('/api/v1/auth/login', authController.login);

// Đăng nhập bằng tài khoản Google
router.post('/api/v1/auth/login/social-account', authController.loginSocialAccount);

// Đăng ký tài khoản
router.post('/api/v1/auth/register', authController.register);

// Đăng ký tài khoản - version 2
router.post('/api/v2/auth/register', authController.registerAccount);

// Nhận mã otp khi đăng ký tài khoản
router.post('/api/v1/auth/verify/create-account', authController.verifyOTPCreateAccount);

// Khóa tài khoản
router.put('/api/v1/auth/active-account/:userId', auth, authController.activeAccount);

// Khôi phục mật khẩu
router.post('/api/v1/auth/recovery-password', authController.recoveryPassword);

// Xác thực mã otp cho khôi phục mật khẩu
router.post('/api/v1/auth/verify/recovery-password', authController.verifyOTPRecoveryPassword);

// Thay đổi mật khẩu
router.put('/api/v1/auth/change-password', auth, authController.changePassword);

// RefreshToken
router.post('/api/v1/auth/refreshToken', authController.refreshToken);

// Set password cho tài khoản mới (guest)
router.post('/api/v1/auth/set-password', authController.setPassword);

// Đăng xuất 
router.post('/api/v1/auth/logout', authController.logout);

module.exports = router;
   