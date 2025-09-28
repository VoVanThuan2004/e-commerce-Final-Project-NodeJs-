const Brand = require("../models/brand");
const Product = require("../models/product");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

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

  if (!req.file || req.file.length === 0) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng upload hình ảnh",
    });
  }

  try {
    // Tạo brand
    const brand = await Brand.create({
      brandName: brandName,
      logo: req.file.path,
      logoPublicId: req.file.filename,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Thêm thương hiệu thành công",
      data: {
        _id: brand._id,
        brandName: brand.brandName,
        logo: brand.logo,
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
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

const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find().select(
      "_id brandName logo createdAt updatedAt"
    );

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
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin: brandId, brandName",
    });
  }

  // Kiểm tra có phải là ObjectId không
  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "brandId không hợp lệ",
    });
  }

  try {
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Thương hiệu không tồn tại",
      });
    }

    // Nếu có upload logo mới
    if (req.file) {
      // Xóa ảnh cũ
      await cloudinary.uploader.destroy(brand.logoPublicId);

      brand.logo = req.file.path;
      brand.logoPublicId = req.file.filename;
    }

    brand.brandName = brandName;
    await brand.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật thông tin thương hiệu thành công",
      data: {
        _id: brand._id,
        brandName: brand.brandName,
        logo: brand.logo,
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
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

const deleteBrand = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const brandId = req.params.brandId;
  // Kiểm tra có phải là ObjectId không
  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "brandId không hợp lệ",
    });
  }

  try {
    // Ktra brand
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Thương hiệu không tồn tại",
      });
    }

    // Ktra brand hiện tại có product nào không -> nếu có -> không cho xóa
    const product = await Product.findOne({ brandId });
    if (product) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Không thể xóa thương hiệu, vì hiện đang có sản phẩm",
      });
    }

    // Nếu brand có image -> xóa image trên cloudinary
    if (brand.logo) {
      await cloudinary.uploader.destroy(brand.logoPublicId);
    }

    await Brand.findByIdAndDelete(brandId);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa thương hiệu thành công",
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
  deleteBrand,
};
