const Category = require("../models/category");
const Product = require("../models/product");
const mongoose = require("mongoose");

const addCategory = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên",
    });
  }

  const { categoryName } = req.body;
  if (!categoryName) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin tên danh mục",
    });
  }

  try {
    const category = await Category.create({
      categoryName: categoryName,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Thêm danh mục thành công",
      data: category,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách danh mục thành công",
      data: categories,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateCategory = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên",
    });
  }

  const categoryId = req.params.categoryId;
  const { categoryName } = req.body;
  if (!categoryId || !categoryName) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin mã id danh mục, tên danh mục",
    });
  }

  // Kiểm id có phải là objectId không
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Mã id danh mục không hợp lệ",
    });
  }

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Danh mục không tồn tại",
      });
    }

    category.categoryName = categoryName;
    await category.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật danh mục thành công",
      data: category,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const deleteCategory = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên",
    });
  }

  const categoryId = req.params.categoryId;
  // Kiểm id có phải là objectId không
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Mã id danh mục không hợp lệ",
    });
  }

  try {
    // Ktra category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Danh mục không tồn tại",
      });
    }

    // Ktra category có product không -> nếu có -> không cho xóa
    const product = await Product.findOne({ categoryId });
    if (product) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Không thể xóa danh mục, vì hiện đang có sản phẩm",
      });
    }

    await Category.findByIdAndDelete(categoryId);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa danh mục thành công",
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
  addCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
