require("dotenv").config();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const Role = require("../models/role");
const RefreshToken = require("../models/refreshToken");
const SocialAccount = require("../models/socialAccount");
const Address = require("../models/address");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.CLIENT_ID);
const {
  sendCreateAccount,
  sendRecoveryPassword,
  sendAccountPassword,
} = require("../config/mailConfig");
const mongoose = require("mongoose");
const crypto = require("crypto");

const login = async (req, res) => {
  // Lấy email, password
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập đầy đủ thông tin: email, password",
    });
  }

  try {
    // Tìm user
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Email không hợp lệ",
      });
    }

    // So sánh password
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mật khẩu không hợp lệ",
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Tài khoản đã bị khóa",
      });
    }

    const role = await Role.findById(user.roleId);
    const SECRET_KEY = process.env.SECRET_KEY;

    // Tạo ra mã accessToken
    const accessToken = jwt.sign(
      {
        userId: user._id,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      SECRET_KEY,
      {
        expiresIn: "30d",
      }
    );

    // Tạo ra mã refreshToken
    const refreshToken = jwt.sign(
      {
        userId: user._id,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      SECRET_KEY,
      {
        expiresIn: "60d",
      }
    );

    await RefreshToken.create({
      userId: user._id,
      refreshToken: refreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
    });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Đăng nhập thành công",
      data: {
        userId: user._id,
        fullName: user.fullName,
        roleName: role.roleName,
        accessToken: accessToken,
        refreshToken: refreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const loginSocialAccount = async (req, res) => {
  const { provider, idToken } = req.body;
  if (!provider || !idToken) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin: provider, idToken",
    });
  }

  if (provider !== "google") {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Nhà cung cấp không được hỗ trợ",
    });
  }

  try {
    // Verify token với google
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Lấy thông tin user từ google
    const email = payload.email;
    const fullName = payload.fullName;
    const avatar = payload.avatar;
    const provider_user_id = payload.sub;

    const role = await Role.findOne({ roleName: "USER" });
    if (!role) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Vai trò dành cho người dùng không tồn tại",
      });
    }

    // Kiểm tra user có tồn tại chưa
    let user = await User.findOne({ email });
    if (!user) {
      // user chưa tồn tại tạo tài khoản
      user = await User.create({
        roleId: role._id,
        email: email,
        fullName: fullName,
        password: "",
        avatar: avatar,
        isActive: true,
      });
    }

    // Kiểm tra nếu tài khoản đã bị khóa
    if (!user.isActive) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Tài khoản đã bị khóa",
      });
    }

    // Kiểm tra xem tồn tại SocialAccount chưa
    let socialAccount = await SocialAccount.findOne({
      provider,
      provider_user_id,
    });
    if (!socialAccount) {
      socialAccount = await SocialAccount.create({
        userId: user._id,
        provider: provider,
        provider_user_id: provider_user_id,
      });
    }

    const SECRET_KEY = process.env.SECRET_KEY;

    // Tạo ra mã accessToken
    const accessToken = jwt.sign(
      {
        userId: user._id,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      SECRET_KEY,
      {
        expiresIn: "24h",
      }
    );

    // Tạo ra mã refreshToken
    const refreshToken = jwt.sign(
      {
        userId: user._id,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      SECRET_KEY,
      {
        expiresIn: "30d",
      }
    );

    await RefreshToken.create({
      userId: user._id,
      refreshToken: refreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
    });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Đăng nhập tài khoản Google thành công",
      data: {
        userId: user._id,
        fullName: fullName,
        roleName: role.roleName,
        accessToken: accessToken,
        refreshToken: refreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const register = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập email",
    });
  }

  try {
    // Kiểm tra tài khoản có tồn tại
    const user = await User.findOne({ email });
    const role = await Role.findOne({ roleName: "USER" });
    if (!role) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Vai trò dành cho người dùng không tồn tại",
      });
    }

    if (!user) {
      // Tạo mã otp
      const OTP = Math.floor(100000 + Math.random() * 900000).toString();
      const OTPHashed = await bcrypt.hash(OTP, 10);

      await User.create({
        roleId: role._id,
        email: email,
        fullName: "",
        password: "",
        isActive: false,
        reset_otp: OTPHashed,
        reset_otp_expired: new Date(Date.now() + 5 * 60 * 1000), // 5 phút
      });

      // Gửi email
      await sendCreateAccount(email, OTP);

      return res.status(200).json({
        status: "success",
        code: 200,
        message: "Mã OTP đã được gửi đến email của bạn",
      });
    }
    // TH2. User có tồn tại
    else {
      // Kiểm tra xem có tài khoản social account không
      if (user.password === "") {
        // Tạo mã otp
        const OTP = Math.floor(100000 + Math.random() * 900000).toString();
        const OTPHashed = await bcrypt.hash(OTP, 10);

        // Cập nhật mã reset otp
        user.reset_otp = OTPHashed;
        user.reset_otp_expired = new Date(Date.now() + 5 * 60 * 1000); // 5 phút
        await user.save();

        // Gửi email
        await sendCreateAccount(email, OTP);

        return res.status(200).json({
          status: "success",
          code: 200,
          message: "Mã OTP đã được gửi đến email của bạn",
        });
      } else {
        return res.status(400).json({
          status: "error",
          code: 400,
          message: "Tài khoản đã tồn tại",
        });
      }
    }
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// API đăng ký tài khoản - version 2 (TỰ ĐỘNG LOGIN SAU ĐĂNG KÝ)
const registerAccount = async (req, res) => {
  const { email, fullName, address } = req.body;

  // === 1. VALIDATE ===
  if (!email || !fullName || !address) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập đầy đủ thông tin: email, fullName, address",
    });
  }

  const required = [
    "ward",
    "wardCode",
    "district",
    "districtCode",
    "province",
    "provinceCode",
    "addressDetail",
  ];
  for (const field of required) {
    if (!address[field]) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Vui lòng nhập đầy đủ ${field} trong địa chỉ`,
      });
    }
  }

  try {
    // === 2. TÌM USER & ROLE ===
    const [existingUser, role] = await Promise.all([
      User.findOne({ email }),
      Role.findOne({ roleName: "USER" }),
    ]);

    if (!role) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Vai trò USER không tồn tại",
      });
    }

    // === 3. TẠO MẬT KHẨU NGẪU NHIÊN ===
    const password = generateRandomPassword(10);
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    // === 4. XỬ LÝ 2 TRƯỜNG HỢP ===
    if (!existingUser) {
      // TH1: TÀI KHOẢN MỚI
      user = await User.create({
        roleId: role._id,
        email,
        fullName,
        password: hashedPassword,
        isActive: true,
      });

      await Address.create({
        userId: user._id,
        ...address,
        isDefault: true,
      });

      await sendAccountPassword(email, password);
    } else {
      // TH2: SOCIAL ACCOUNT → HOÀN THIỆN
      if (existingUser.password !== "") {
        return res.status(409).json({
          status: "error",
          code: 409,
          message: "Email đã được sử dụng",
        });
      }

      existingUser.fullName = fullName;
      existingUser.password = hashedPassword;
      await existingUser.save();

      await Address.create({
        userId: existingUser._id,
        ...address,
        isDefault: true,
      });

      await sendAccountPassword(email, password);

      user = existingUser;
    }

    // === 5. TẠO ACCESS & REFRESH TOKEN ===
    const accessToken = jwt.sign(
      {
        userId: user._id,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      process.env.SECRET_KEY,
      { expiresIn: "30d" }
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      process.env.SECRET_KEY,
      { expiresIn: "60d" }
    );

    // === 6. TRẢ VỀ TOKEN + USER INFO ===
    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Đăng ký thành công! Đã tự động đăng nhập.",
      data: {
        accessToken,
        refreshToken,
        user: {
          userId: user._id,
          email: user.email,
          fullName: user.fullName,
          roleName: role.roleName,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

function generateRandomPassword(length = 10) {
  // Sinh chuỗi ngẫu nhiên rồi mã hóa base64 → cắt gọn
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "") // loại ký tự đặc biệt để tránh lỗi khi gửi mail
    .slice(0, length);
}

const verifyOTPCreateAccount = async (req, res) => {
  const { email, fullName, gender, otp, password, address } = req.body;

  if (!email || !fullName || !gender || !otp || !password || !address) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message:
        "Vui lòng nhập đầy đủ thông tin: email, fullName, gender, otp, password, address",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Mật khẩu phải có ít nhất 8 ký tự",
    });
  }

  // Kiểm tra các trường thông tin địa chỉ
  if (
    !address.ward ||
    !address.wardCode ||
    !address.district ||
    !address.districtCode ||
    !address.province ||
    !address.provinceCode ||
    !address.addressDetail
  ) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập đầy đủ thông tin địa chỉ giao hàng",
    });
  }

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Email không hợp lệ",
      });
    }

    // Kiểm tra mã otp có khớp hay không
    if (!(await bcrypt.compare(otp, user.reset_otp))) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mã OTP không hợp lệ",
      });
    }

    // Kiểm tra thời gian hết hạn mã otp
    if (user.reset_otp_expired < Date.now()) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mã OTP đã hết hạn, vui lòng đăng ký lại",
      });
    }

    const passwordHashed = await bcrypt.hash(password, 10);

    const userId = user._id;

    // Tạo tài khoản
    user.fullName = fullName;
    user.gender = gender;
    user.password = passwordHashed;
    user.isActive = true;
    user.reset_otp = null;
    user.reset_otp_expired = null;
    await user.save();

    // Tạo địa chỉ
    await Address.create({
      userId,
      wardCode: address.wardCode,
      ward: address.ward,
      districtCode: address.districtCode,
      district: address.district,
      provinceCode: address.provinceCode,
      province: address.province,
      addressDetail: address.addressDetail,
      isDefault: true,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Tạo tài khoản thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// API mở khóa - khóa tài khoản
const activeAccount = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      mesage: "Không có quyền truy cập tài nguyên",
    });
  }

  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng cung cấp userId",
    });
  }

  // Kiểm tra userId có phải là ObjectId không
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "userId không hợp lệ",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    // Thay đổi trạng thái hiện tại
    const currentStatus = user.isActive;
    if (user.isActive === true) {
      user.isActive = false;
      await user.save();
    } else {
      user.isActive = true;
      await user.save();
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: currentStatus
        ? "Tài khoản đã khóa"
        : "Tài khoản đã được kích hoạt",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// API đăng xuất
const logout = async (req, res) => {
  // Nhận refreshToken từ body
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin: refreshToken",
    });
  }

  try {
    const refreshTokenDB = await RefreshToken.findOne({ refreshToken });
    if (!refreshTokenDB) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Mã refresh token không tồn tại",
      });
    }

    // Xóa mã refreshToken
    await RefreshToken.findByIdAndDelete(refreshTokenDB._id);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// API khôi phục mật khẩu
const recoveryPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập email",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Email không hợp lệ",
      });
    }

    const OTP = Math.floor(100000 + Math.random() * 900000).toString();
    const OTPHashed = await bcrypt.hash(OTP, 10);

    user.reset_otp = OTPHashed;
    user.reset_otp_expired = new Date(Date.now() + 5 * 60 * 1000); // 5 phút
    await user.save();

    // gửi email
    await sendRecoveryPassword(email, OTP);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Mã OTP đã được gửi đến email của bạn",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const verifyOTPRecoveryPassword = async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;
  if (!email || !otp || !password || !confirmPassword) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin: email, otp, password",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Email không hợp lệ",
      });
    }

    // Kiểm tra mã otp có hợp lệ
    if (!(await bcrypt.compare(otp, user.reset_otp))) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mã OTP không hợp lệ",
      });
    }

    // Kiểm tra thời gian hết hạn mã otp
    if (user.reset_otp_expired < Date.now()) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mã OTP đã hết hạn, vui lòng đăng ký lại",
      });
    }

    // Kiểm tra password
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mật khẩu xác nhận không khớp",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mật khẩu phải có ít nhất 8 ký tự",
      });
    }

    // Tạo password mới cho user
    const passwordHashed = await bcrypt.hash(password, 10);
    user.password = passwordHashed;
    user.reset_otp = null;
    user.reset_otp_expired = null;
    await user.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Khôi phục mật khẩu thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// API lấy accessToken mới từ refreshToken cũ
const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin mã refresh token",
    });
  }

  try {
    const refreshTokenDB = await RefreshToken.findOne({ refreshToken });
    if (!refreshTokenDB) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Mã refresh token không hợp lệ",
      });
    }

    const userId = refreshTokenDB.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    const role = await Role.findOne({ _id: user.roleId });
    if (!role) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Vai trò cho người dùng không tồn tại",
      });
    }

    // Xóa mã refresh token cũ nếu có
    await RefreshToken.deleteOne({ refreshToken });

    const SECRET_KEY = process.env.SECRET_KEY;

    // Tạo mã access token
    const newAccessToken = jwt.sign(
      {
        userId,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      SECRET_KEY,
      {
        expiresIn: "24h",
      }
    );

    // Tạo mã refresh token
    const newRefreshToken = jwt.sign(
      {
        userId,
        fullName: user.fullName,
        roleName: role.roleName,
      },
      SECRET_KEY,
      {
        expiresIn: "30d",
      }
    );

    // Lưu mã refresh token mới vào db
    await RefreshToken.create({
      userId,
      refreshToken: newRefreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Tạo refresh token mới thành công",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const setPassword = async (req, res) => {
  const { email, token, password, confirmPassword } = req.body;
  if (!email || !token) {
    s;
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin email, mã token",
    });
  }

  const decoded = jwt.verify(token, process.env.SECRET_KEY);
  // Kiểm tra email và email trong token
  if (email !== decoded.email) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Email không hợp lệ",
    });
  }

  // Kiểm tra type trong token
  if (decoded.type !== "set_password") {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Token không hợp lệ",
    });
  }

  // Kiểm tra password
  if (password !== confirmPassword) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Mật khẩu xác nhận không hợp lệ",
    });
  }

  // Kiểm tra độ dài password
  if (password.length < 8) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Mật khẩu phải có ít nhất 8 ký tự",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // cập nhật password
    user.password = hashedPassword;
    user.isActive = true;
    await user.save();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Liên kết đặt mật khẩu đã hết hạn. Vui lòng yêu cầu lại.",
      });
    }

    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.mesage,
    });
  }
};

const changePassword = async (req, res) => {
  // Lấy userId từ người dùng
  const userId = req.user.userId;
  if (!userId) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Không có thông tin id của người dùng",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID của người dùng không hợp lệ",
    });
  }

  const { password, newPassword, confirmNewPassword } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    if (!password || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Vui lòng nhập thông tin: password, newPassword",
      });
    }

    // Kiểm tra mật khẩu cũ có đúng
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mật khẩu hiện tại không đúng",
      });
    }

    // Kiểm tra password cũ và password mới trùng nhau
    if (password === newPassword || password === confirmNewPassword) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mật khẩu hiện tại đang trùng với mật khẩu mới",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mật khẩu xác nhận không khớp",
      });
    }

    // Kiểm tra độ dài password mới
    if (newPassword.length < 8) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Mật khẩu phải có ít nhất 8 ký tự",
      });
    }

    // Cập nhật mật khẩu cho người dùng
    const passwordHashed = await bcrypt.hash(newPassword, 10);
    user.password = passwordHashed;
    await user.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Thay đổi mật khẩu thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

module.exports = {
  login,
  logout,
  loginSocialAccount,
  register,
  registerAccount,
  verifyOTPCreateAccount,
  verifyOTPRecoveryPassword,
  activeAccount,
  recoveryPassword,
  changePassword,
  setPassword,
  refreshToken,
};
  