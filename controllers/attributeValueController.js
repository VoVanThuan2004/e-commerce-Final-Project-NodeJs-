const mongoose = require("mongoose");
const AttributeValue = require("../models/attributeValue");
const Attribute = require("../models/attribute");
const VariantAttribute = require("../models/variantAttribute");

const addAttributeValue = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  // Kiểm tra id thuộc tính
  const attributeId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(attributeId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID thuộc tính không hợp lệ",
    });
  }

  const { value } = req.body;
  if (!value) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin giá trị của thuộc tính",
    });
  }

  try {
    const attribute = await Attribute.findById(attributeId);
    if (!attribute) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Thuộc tính không tồn tại",
      });
    }

    // Tạo giá trị cho thuộc tính
    const attributeValueCreate = await AttributeValue.create({
      attributeId,
      value,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Tạo giá trị thuộc tính thành công",
      data: attributeValueCreate,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateAttributeValue = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const attributeValueId = req.params.valueId;
  if (!mongoose.Types.ObjectId.isValid(attributeValueId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID giá trị thuộc tính không hợp lệ",
    });
  }

  const { value } = req.body;
  if (!value) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin giá trị của thuộc tính",
    });
  }

  try {
    const attributeValue = await AttributeValue.findById(attributeValueId);
    if (!attributeValue) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Giá trị thuộc tính không tồn tạii",
      });
    }

    // cập nhật giá trị
    attributeValue.value = value;
    await attributeValue.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật giá trị thuộc tính thành công",
      data: attributeValue,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const deleteAttributeValue = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const attributeValueId = req.params.valueId;
  if (!mongoose.Types.ObjectId.isValid(attributeValueId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID giá trị thuộc tính không hợp lệ",
    });
  }

  try {
    const attributeValue = await AttributeValue.findById(attributeValueId);
    if (!attributeValue) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Giá trị thuộc tính không tồn tại",
      });
    }

    // Kiểm tra nếu giá trị thuộc tính đã có sản phẩm tham chiếu -> không xóa
    const variantAttribute = await VariantAttribute.findOne({ attributeValueId });
    if (variantAttribute) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Giá trị thuộc tính không thể xóa, vì đã có sản phẩm biến thể đang có giá trị thuộc tính này",
      });
    }

    // Xóa giá trị thuộc tính
    await AttributeValue.findByIdAndDelete(attributeValueId);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa giá trị thuộc tính thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getAllAttributeValues = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const attributeId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(attributeId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID thuộc tính không hợp lệ",
    });
  }

  try {
    const attributeValues = await AttributeValue.find({ attributeId });

    return res.status(200).json({
        status: 'success',
        code: 200,
        message: 'Lấy danh sách giá trị thuộc tính',
        data: attributeValues
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
  addAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  getAllAttributeValues,
};
