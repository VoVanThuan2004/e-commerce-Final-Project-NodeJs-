const Coupon = require("../models/coupon");
const mongoose = require("mongoose");
//controller/couponController.js
const addCoupon = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { couponCode, discountPrice, usageLimit } = req.body;
  if (!couponCode || !discountPrice || !usageLimit) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập đầy đủ thông tin cho mã giảm giá",
    });
  }

  try {
    const coupon = await Coupon.create({
      couponCode,
      discountPrice,
      usageLimit,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Thêm mã giảm giá thành công",
      data: coupon,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateCoupon = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { couponId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID mã giảm giá không hợp lệ",
    });
  }

  const { couponCode, discountPrice, usageLimit } = req.body;
  if (!couponCode || !discountPrice || !usageLimit) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập đầy đủ thông tin cho mã giảm giá",
    });
  }

  try {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Mã giảm giá không tồn tại",
      });
    }

    coupon.couponCode = couponCode;
    coupon.discountPrice = discountPrice;
    coupon.usageLimit = usageLimit;

    await coupon.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Mã giảm giá đã cập nhật thành công",
      data: coupon,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const deleteCoupon = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { couponId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID mã giảm giá không hợp lệ",
    });
  }

  try {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Mã giảm giá không tồn tại",
      });
    }

    await Coupon.findByIdAndDelete(couponId);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa mã giảm giá thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getAllCoupons = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const skip = (page - 1) * limit;

  try {
    const [coupons, totalCoupons] = await Promise.all([
      Coupon.find().skip(skip).limit(limit),
      Coupon.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalCoupons / limit);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách mã giảm giá thành công",
      data: coupons,
      pagination: {
        page,
        limit,
        totalPages,
        totalCoupons,
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

const checkCoupon = async (req, res) => {
  try {
    const couponCode = req.query.couponCode;
    if (!couponCode) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Vui lòng nhập mã giảm giá",
      });
    }

    // 1. Kiểm tra coupon có tồn tại
    const coupon = await Coupon.findOne({ couponCode });
    if (!coupon) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Mã giảm giá không hợp lệ",
      });
    }

    // 2. Kiểm tra còn lượt sử dụng
    if (coupon.usageLimit === coupon.usedCount) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Mã giảm giá đã hết số lượng",
      });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy mã giảm giá thành công",
      data: {
        _id: coupon._id,
        couponCode: coupon.couponCode,
        discountPrice: coupon.discountPrice,
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

module.exports = {
  addCoupon,
  updateCoupon,
  deleteCoupon,
  getAllCoupons,
  checkCoupon,
};
