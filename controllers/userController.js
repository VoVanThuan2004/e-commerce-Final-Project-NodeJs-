require("dotenv").config();
const User = require("../models/user");
const Role = require("../models/role");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

// API lấy danh sách người dùng
const getAllUsers = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên",
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const skip = (page - 1) * limit;

  try {
    const role = await Role.findOne({ roleName: "ADMIN" });
    if (!role) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Vai trò không hợp lệ",
      });
    }

    // Lấy tổng số lượng người dùng - danh sách người dùng
    const [totalUsers, users] = await Promise.all([
      User.countDocuments({ roleId: { $ne: role._id } }),
      User.find({ roleId: { $ne: role._id } })
        .select(
          "_id email fullName avatar phoneNumber gender loyaltyPoints isActive"
        )
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
    ]);

    const totalPages = Math.ceil(totalUsers / limit);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách người dùng",
      data: users,
      pagination: {
        totalUsers,
        totalPages,
        currentPage: page,
        limit,
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

// API cập nhật thông tin người dùng
const updateUser = async (req, res) => {
  const userId = req.user.userId;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    await deleteUploadedFile(req.file);
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID người dùng không hợp lệ",
    });
  }

  const { fullName, phoneNumber, gender } = req.body;
  if (!fullName || !phoneNumber || !gender) {
    // Xóa file ảnh đã up lên cloudinary
    await deleteUploadedFile(req.file);
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin: fullName, phoneNumber, gender",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      await deleteUploadedFile(req.file);
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    // Kiểm tra nếu có upload ảnh
    if (req.file) {
      // Xóa ảnh cũ
      if (user.avatarPublicId !== null) {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      }

      user.avatar = req.file.path;
      user.avatarPublicId = req.file.filename;
    }

    user.fullName = fullName;
    user.phoneNumber = phoneNumber;
    user.gender = gender;
    await user.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật thông tin người dùng thành công",
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// API lấy thông tin profile
const getUserProfile = async (req, res) => {
  const userId = req.user.userId;
  if (!userId) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Không có thông tin id của người dùng",
    });
  }

  try {
    const user = await User.findById(userId).select(
      "_id email fullName avatar phoneNumber gender loyaltyPoints isActive"
    );
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy thông tin profile của người dùng",
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// API cập nhật thông tin người dùng dành cho admin
const updateUserByAdmin = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    await deleteUploadedFile(req.file);
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên",
    });
  }

  const userId = req.params.userId;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    await deleteUploadedFile(req.file);
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Tham số userId hiện đang trống",
    });
  }

  const { fullName, phoneNumber, gender } = req.body;
  if (!fullName || !phoneNumber || !gender) {
    await deleteUploadedFile(req.file);
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin: fullName, phoneNumber, gender",
    });
  }

  try {
    let user = await User.findById(userId);
    if (!user) {
      await deleteUploadedFile(req.file);
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    user.fullName = fullName;
    user.phoneNumber = phoneNumber;
    user.gender = gender;

    // Nếu có upload ảnh
    if (req.file) {
      // Xóa id ảnh cũ
      if (user.avatarPublicId !== null) {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      }

      user.avatar = req.file.path;
      user.avatarPublicId = req.file.filename;
    }

    user = await user.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật thông tin người dùng thành công",
      data: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        phoneNumber: user.phoneNumber,
        loyaltyPoints: user.loyaltyPoints,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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

// Function xóa ảnh upload cloudinary
const deleteUploadedFile = async (file) => {
  if (file && file.filename) {
    await cloudinary.uploader.destroy(file.filename);
  }
};

const getLoyaltyPoints = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Kiểm tra user có tồn tại
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không hợp lệ",
      });
    }

    const loyaltyPoints = user.loyaltyPoints;

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy điểm tích lũy hiện tại của người dùng",
      data: loyaltyPoints,
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
  getAllUsers,
  updateUser,
  getUserProfile,
  updateUserByAdmin,
  getLoyaltyPoints,
};
