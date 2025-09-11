const Attribute = require("../models/attribute");
const AttributeValue = require("../models/attributeValue");
const mongoose = require('mongoose');

const createAttribute = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { attributeName } = req.body;
  if (!attributeName) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin tên thuộc tính",
    });
  }

  try {
    const attribute = await Attribute.create({
      attributeName: attributeName,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Thuộc tính tạo thành công",
      data: attribute,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateAttribute = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const attributeId = req.params.attributeId;
  const { attributeName } = req.body;
  if (!attributeId || !attributeName) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin id thuộc tính, tên thuộc tính",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(attributeId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID thuộc tính không hợp lệ",
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

    // cập nhật thuộc tính
    attribute.attributeName = attributeName;
    await attribute.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật thuộc tính thành công",
      data: attribute,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const deleteAttribute = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const attributeId = req.params.attributeId;
  if (!attributeId || attributeId.trim() === "") {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin id thuộc tính",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(attributeId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID thuộc tính không hợp lệ",
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

    // Kiểm tra xem thuộc tính này đã có giá trị chưa, nếu có không cho xóa
    const attributeValue = await AttributeValue.findOne({ attributeId });
    if (attributeValue) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Không thể xóa, vì thuộc tính đang có chứa giá trị",
      });
    }

    // xóa thuộc tính
    await Attribute.findByIdAndDelete(attributeId);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa thuộc tính thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getAllAttributes = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  try {
    const attributes = await Attribute.find();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy tất cả thuộc tính",
      data: attributes,
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
  createAttribute,
  updateAttribute,
  getAllAttributes,
  deleteAttribute,
};
