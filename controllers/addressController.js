const Address = require("../models/address");

// Thêm địa chỉ mới
const createAddress = async (req, res) => {
  try {
    const address = new Address({ ...req.body, userId: req.user.userId });
    const savedAddress = await address.save();

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Thêm địa chỉ thành công",
      data: savedAddress,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// Cập nhật địa chỉ
const updateAddress = async (req, res) => {
  try {
    const updated = await Address.findOneAndUpdate(
      { _id: req.params.addressId, userId: req.user.userId },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Không tìm thấy địa chỉ",
      });
    }

    return res.json({
      status: "success",
      code: 200,
      message: "Cập nhật địa chỉ thành công",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// Xóa địa chỉ
const deleteAddress = async (req, res) => {
  try {
    const deleted = await Address.findOneAndDelete({
      _id: req.params.addressId,
    });
    if (!deleted) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Không tìm thấy địa chỉ",
      });
    }

    return res.json({
      status: "success",
      code: 200,
      message: "Xóa địa chỉ thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// Lấy tất cả địa chỉ của user
const getAllAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user.userId })
      .sort({
        createdAt: -1,
      })
      .select(
        "_id userId wardCode ward districtCode district provinceCode province addressDetail isDefault"
      );

    return res.json({
      status: "success",
      code: 200,
      message: "Lấy danh sách địa chỉ thành công",
      data: addresses,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// Cài đặt địa chỉ mặc định
const setDefaultAddress = async (req, res) => {
  try {
    // Bỏ mặc định các địa chỉ khác
    await Address.updateMany(
      { userId: req.user.userId },
      { $set: { isDefault: false } }
    );

    // Set địa chỉ được chọn thành mặc định
    const updated = await Address.findOneAndUpdate(
      { _id: req.params.addressId },
      { $set: { isDefault: true } },
      { new: true }
    ).select(
      "_id userId wardCode ward districtCode district provinceCode province addressDetail isDefault"
    );

    if (!updated) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Không tìm thấy địa chỉ",
      });
    }

    return res.json({
      status: "success",
      code: 200,
      message: "Đặt địa chỉ mặc định thành công",
      data: updated,
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
  createAddress,
  updateAddress,
  deleteAddress,
  getAllAddresses,
  setDefaultAddress,
};
