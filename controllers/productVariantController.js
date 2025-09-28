const ProductVariant = require("../models/productVariant");
const VariantAttribute = require("../models/variantAttribute");
const AttributeValue = require("../models/attributeValue");
const VariantImage = require("../models/variantImage");
const Product = require("../models/product");
const Inventory = require("../models/inventory");
const cloudinary = require("../config/cloudinary");
const productVariant = require("../models/productVariant");

const addProductVariant = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const {
    productId,
    attributeValueIds,
    sellingPrice,
    originalPrice,
    quantity,
  } = req.body;
  if (
    !productId ||
    !attributeValueIds ||
    !sellingPrice ||
    !originalPrice ||
    !quantity
  ) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message:
        "Vui lòng nhập đầy đủ thông tin mã sản phẩm, giá trị thuộc tính, giá bán, giá gốc, tồn kho",
    });
  }

  if (originalPrice > sellingPrice) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập giá gốc nhỏ hơn giá bán",
    });
  }

  // Kiểm tra có upload ảnh
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng upload ảnh",
    });
  }

  try {
    // tìm product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm gốc không tồn tại",
      });
    }

    // lấy tên các attribute value
    const attributeValues = await AttributeValue.find({
      _id: { $in: attributeValueIds },
    });
    const attrName = attributeValues.map((attrValue) => attrValue.value);

    const productVariantName = `${product.name} - ${attrName.join(" - ")}`;

    // Tạo product variant
    const productVariant = await ProductVariant.create({
      name: productVariantName,
      sellingPrice,
      originalPrice,
      isActive: true,
      productId,
    });

    // Thêm ảnh cho sp biến thể
    const variantImages = req.files.map((file) => ({
      productVariantId: productVariant._id,
      imageUrl: file.path,
      imageUrlPublicId: file.filename,
    }));

    await VariantImage.insertMany(variantImages);

    // Tạo variant attribute
    const variantAttributeDB = attributeValueIds.map((attributeValueId) => ({
      productVariantId: productVariant._id,
      attributeValueId: attributeValueId,
    }));

    await VariantAttribute.insertMany(variantAttributeDB);

    // Tạo tồn kho cho sp biến thể
    await Inventory.create({
      quantity,
      productVariantId: productVariant._id,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Tạo biến thể sản phẩm thành công",
      data: productVariant,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateProductVariant = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const productVariantId = req.params.productVariantId;
  const { productId, attributeValueIds, originalPrice, sellingPrice } =
    req.body;
  if (!productId || !attributeValueIds || !sellingPrice || !originalPrice) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message:
        "Vui lòng nhập đầy đủ thông tin mã sản phẩm, giá trị thuộc tính, giá bán, giá gốc, tồn kho",
    });
  }

  if (originalPrice > sellingPrice) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập giá gốc nhỏ hơn giá bán",
    });
  }

  try {
    // 1. Ktra sp biến thể
    const productVariant = await ProductVariant.findById(productVariantId);
    if (!productVariant) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm biến thể không tồn tại",
      });
    }

    // 2. Ktra sản phẩm gốc
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm gốc không tồn tại",
      });
    }

    // 3. Lấy ra các giá trị thuộc tính
    const attributeValues = await AttributeValue.find({
      _id: { $in: attributeValueIds },
    });
    const attrName = attributeValues.map((attrValue) => attrValue.value);
    const productVariantName = `${product.name} - ${attrName.join(" - ")}`;

    // 4. Cập nhật sp biến thể
    productVariant.name = productVariantName;
    productVariant.originalPrice = originalPrice;
    productVariant.sellingPrice = sellingPrice;
    productVariant.productId = productId;
    await productVariant.save();

    // 5. Nếu có upload ảnh mới
    if (req.files.length > 0) {
      const variantOldImages = await VariantImage.find({
        productVariantId: productVariant._id,
      });

      await Promise.all([
        // Xóa ảnh trên Cloudinary
        ...variantOldImages.map((image) =>
          cloudinary.uploader.destroy(image.imageUrlPublicId)
        ),
        // Xóa bản ghi trong database
        VariantImage.deleteMany({ productVariantId: productVariant._id }),
      ]);

      const variantImages = req.files.map((file) => ({
        productVariantId: productVariant._id,
        imageUrl: file.path,
        imageUrlPublicId: file.filename,
      }));

      await VariantImage.insertMany(variantImages);
    }

    // 6. Xóa variant attribute cũ
    await VariantAttribute.deleteMany({ productVariantId: productVariant._id });

    // 7. Tạo variant attribute mới
    const variantAttributesDB = attributeValueIds.map((attributeValueId) => ({
      productVariantId: productVariant._id,
      attributeValueId,
    }));
    await VariantAttribute.insertMany(variantAttributesDB);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật sản phẩm biến thể thành công",
      data: productVariant
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message
    });
  }
};

const deleteProductVariant = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const productVariantId = req.params;

  try {
    // 1. Tìm sp biến thể
    const productVariant = await ProductVariant.findById(productVariantId);
    if (!productVariant) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm biến thể không tồn tại",
      });
    }

    // 2. Xóa sp biến thể
    await ProductVariant.findByIdAndDelete(productVariantId);

    // 3. Xóa variant attribute
    await VariantAttribute.deleteMany({ productVariantId });

    // 4. Xóa ảnh biến thể
    const variantImages = await VariantImage.find({ productVariantId });

    await Promise.all([
      // Xóa ảnh trên Cloudinary
      ...variantImages.map((image) =>
        cloudinary.uploader.destroy(image.imageUrlPublicId)
      ),
      // Xóa bản ghi trong database
      VariantImage.deleteMany({ productVariantId: productVariant._id }),
    ]);

    // 5. Xóa tồn kho cho sp biến thể
    await Inventory.findOneAndDelete({ productVariantId });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa sản phẩm biến thể thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateInventory = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const productVariantId = req.params.productVariantId;
  const { newQuantity } = req.body;
  if (!newQuantity) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập số lượng tồn kho",
    });
  }

  try {
    // 1. Tìm sp biến thể
    const productVariant = await ProductVariant.findById(productVariantId);
    if (!productVariant) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm biến thể không tồn tại",
      });
    }

    // 2. Cập nhật Inventory
    const inventory = await Inventory.findOne({ productVariantId });
    if (!inventory) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Tồn kho của sản phẩm biến thể không tồn tại",
      });
    }
    inventory.quantity = newQuantity;
    await inventory.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật số lượng tồn kho thành công",
      data: inventory,
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
  addProductVariant,
  updateProductVariant,
  deleteProductVariant,
  updateInventory,
};
