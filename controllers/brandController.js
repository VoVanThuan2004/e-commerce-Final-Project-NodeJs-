const Brand = require("../models/brand");
const mongoose = require('mongoose');

const createBrand = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { brandName } = req.body;
  if (!brandName) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin: brandName",
    });
  }

  try {
    // Tạo brand
    const brand = await Brand.create({
      brandName: brandName,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Thêm thương hiệu thành công",
      data: brand,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách thương hiệu thành công",
      data: brands,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateBrand = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const brandId = req.params.brandId;
  const { brandName } = req.body;
  if (!brandId || !brandName) {
    return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Vui lòng nhập thông tin: brandId, brandName'
    });
  }

  // Kiểm tra có phải là ObjectId không
  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'brandId không hợp lệ'
    }); 
  }

  try {
    const brand = await Brand.findById(brandId);
    if (!brand) {
        return res.status(404).json({
            status: 'error',
            code: 404,
            message: 'Thương hiệu không tồn tại'
        });
    }

    brand.brandName = brandName;
    await brand.save();

    return res.status(200).json({
        status: 'success',
        code: 200,
        message: 'Cập nhật thông tin thương hiệu thành công',
        data: brand
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
  createBrand,
  getAllBrands,
  updateBrand,
};
