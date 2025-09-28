const Coupon = require("../models/coupon");
const mongoose = require("mongoose");

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
      message: "Xóa mã giảm giá thành công"
    });
  } catch (error) {
     return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
}

module.exports = {
  addCoupon,
  updateCoupon,
  deleteCoupon
};
