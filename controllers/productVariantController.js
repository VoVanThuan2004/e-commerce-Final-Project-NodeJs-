const ProductVariant = require("../models/productVariant");
const VariantAttribute = require("../models/variantAttribute");
const AttributeValue = require("../models/attributeValue");
const VariantImage = require("../models/variantImage");
const Product = require("../models/product");
const Inventory = require("../models/inventory");
const CartItem = require("../models/cartItem");
const cloudinary = require("../config/cloudinary");
const client = require("../config/elasticsearch");
const mongoose = require("mongoose");

const addProductVariant = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    await deleteUploadedFile(req.files);
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
    weight,
    width,
    height,
    length,
  } = req.body;

  // Ép kiểu trước khi kiểm tra
  const sPrice = Number(sellingPrice);
  const oPrice = Number(originalPrice);

  if (
    !productId ||
    !attributeValueIds ||
    !sPrice ||
    !oPrice ||
    !quantity ||
    !weight ||
    !width ||
    !height ||
    !length
  ) {
    await deleteUploadedFile(req.files);
    return res.status(400).json({
      status: "error",
      code: 400,
      message:
        "Vui lòng nhập đầy đủ thông tin mã sản phẩm, giá trị thuộc tính, giá bán, giá gốc, tồn kho, cân nặng, chiều rộng, chiều cao, độ dài",
    });
  }

  // Kiểm tra điều kiện sau khi đã ép kiểu
  if (oPrice > sPrice) {
    await deleteUploadedFile(req.files);
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

  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    // Tìm product
    const product = await Product.findById(productId).session(session);
    if (!product) {
      await deleteUploadedFile(req.files);
      await session.abortTransaction();
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm gốc không tồn tại",
      });
    }

    // Lấy tên các attribute value
    const attributeValues = await AttributeValue.find({
      _id: { $in: attributeValueIds },
    }).session(session);
    const attrName = attributeValues.map((attrValue) => attrValue.value);

    const productVariantName = `${product.name} - ${attrName.join(" - ")}`;

    // Tạo product variant
    const productVariant = await ProductVariant.create(
      [
        {
          name: productVariantName,
          sellingPrice,
          originalPrice,
          isActive: true,
          productId,
          weight,
          width,
          height,
          length,
        },
      ],
      { session }
    );

    const createdVariant = productVariant[0];

    // Thêm ảnh cho sp biến thể
    const variantImages = req.files.map((file) => ({
      productVariantId: createdVariant._id,
      imageUrl: file.path,
      imageUrlPublicId: file.filename,
    }));

    await VariantImage.insertMany(variantImages, { session });

    // Tạo variant attribute
    const variantAttributeDB = attributeValueIds.map((attributeValueId) => ({
      productVariantId: createdVariant._id,
      attributeValueId: attributeValueId,
    }));

    await VariantAttribute.insertMany(variantAttributeDB, { session });

    // Tạo tồn kho cho sp biến thể
    await Inventory.create(
      [
        {
          quantity,
          productVariantId: createdVariant._id,
        },
      ],
      { session }
    );

    // Lấy tất cả các biến thể, cập nhật lại giá hiển thị cho product
    const allVariants = await ProductVariant.find({
      productId,
      isActive: true,
    }).session(session);

    // Xử lý trường hợp không có biến thể nào
    let minSellingPrice = sellingPrice;
    if (allVariants.length > 0) {
      minSellingPrice = Math.min(
        ...allVariants.map((variant) => variant.sellingPrice)
      );
    }

    // Cập nhật giá product gốc
    await Product.findByIdAndUpdate(
      productId,
      { price: minSellingPrice },
      { session }
    );

    // Commit tất cả thay đổi MongoDB
    await session.commitTransaction();

    // Cập nhật trên ElasticSearch (sau khi commit thành công)
    try {
      await client.update({
        index: "products",
        id: productId.toString(),
        doc: {
          price: minSellingPrice,
          // Chỉ cần update price, không cần update toàn bộ field
        },
      });
    } catch (esError) {
      console.error("ElasticSearch update failed:", esError);
      // Không rollback MongoDB, chỉ ghi log
      // Có thể implement retry mechanism sau
    }

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Tạo biến thể sản phẩm thành công",
      data: createdVariant,
    });
  } catch (error) {
    // Rollback tự động khi có lỗi
    await session.abortTransaction();

    console.error("Add product variant error:", error);
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  } finally {
    await session.endSession();
  }
};

const updateProductVariant = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    await deleteUploadedFile(req.files);
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const productVariantId = req.params.productVariantId;
  const {
    productId,
    attributeValueIds,
    originalPrice,
    sellingPrice,
    weight,
    width,
    height,
    length,
  } = req.body;

  // Ép kiểu trước khi kiểm tra
  const sPrice = Number(sellingPrice);
  const oPrice = Number(originalPrice);
  if (
    !productId ||
    !attributeValueIds ||
    !sPrice ||
    !oPrice ||
    !weight ||
    !width ||
    !height ||
    !length
  ) {
    await deleteUploadedFile(req.files);
    return res.status(400).json({
      status: "error",
      code: 400,
      message:
        "Vui lòng nhập đầy đủ thông tin mã sản phẩm, giá trị thuộc tính, giá bán, giá gốc, tồn kho",
    });
  }

  if (oPrice > sPrice) {
    await deleteUploadedFile(req.files);
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập giá gốc nhỏ hơn giá bán",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Ktra sp biến thể
    const productVariant = await ProductVariant.findById(
      productVariantId
    ).session(session);
    if (!productVariant) {
      await deleteUploadedFile(req.files);
      await session.abortTransaction();
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm biến thể không tồn tại",
      });
    }

    // 2. Ktra sản phẩm gốc
    const product = await Product.findById(productId).session(session);
    if (!product) {
      await deleteUploadedFile(req.files);
      await session.abortTransaction();
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm gốc không tồn tại",
      });
    }

    // 3. Lấy ra các giá trị thuộc tính
    const attributeValues = await AttributeValue.find({
      _id: { $in: attributeValueIds },
    }).session(session);
    const attrName = attributeValues.map((attrValue) => attrValue.value);
    const productVariantName = `${product.name} - ${attrName.join(" - ")}`;

    const oldSellingPrice = productVariant.sellingPrice;
    const priceChanged = oldSellingPrice !== sellingPrice;

    // 4. Cập nhật sp biến thể
    productVariant.name = productVariantName;
    productVariant.originalPrice = originalPrice;
    productVariant.sellingPrice = sellingPrice;
    productVariant.productId = productId;
    productVariant.weight = weight;
    productVariant.width = width;
    productVariant.height = height;
    productVariant.length = length;
    await productVariant.save({ session });

    // 5. Nếu có upload ảnh mới
    if (req.files.length > 0) {
      // const variantOldImages = await VariantImage.find({
      //   productVariantId: productVariant._id,
      // }).session(session);

      // Xóa bản ghi trong database
      await VariantImage.deleteMany({
        productVariantId: productVariant._id,
      }).session(session);

      const variantImages = req.files.map((file) => ({
        productVariantId: productVariant._id,
        imageUrl: file.path,
        imageUrlPublicId: file.filename,
      }));

      await VariantImage.insertMany(variantImages, { session });
    }

    // 6. Xóa variant attribute cũ
    await VariantAttribute.deleteMany({
      productVariantId: productVariant._id,
    }).session(session);

    // 7. Tạo variant attribute mới
    const variantAttributesDB = attributeValueIds.map((attributeValueId) => ({
      productVariantId: productVariant._id,
      attributeValueId,
    }));
    await VariantAttribute.insertMany(variantAttributesDB, { session });

    // 7. Nếu giá thay đổi, cập nhật lại giá thấp nhất cho product
    if (priceChanged) {
      const allVariants = await ProductVariant.find({
        productId,
        isActive: true,
      }).session(session);

      // Xử lý trường hợp không còn biến thể nào
      let minSellingPrice = 0;
      if (allVariants.length > 0) {
        minSellingPrice = Math.min(
          ...allVariants.map((variant) => variant.sellingPrice)
        );
      }

      await Product.findByIdAndUpdate(
        productId,
        { price: minSellingPrice },
        { session }
      );
    }

    // 8. Commit tất cả thay đổi MongoDB
    await session.commitTransaction();

    // 9. Xóa ảnh cũ trên Cloudinary (sau khi commit thành công)
    if (req.files && req.files.length > 0) {
      const variantOldImages = await VariantImage.find({
        productVariantId: productVariant._id,
      });

      if (variantOldImages.length > 0) {
        await Promise.all(
          variantOldImages.map((image) =>
            cloudinary.uploader.destroy(image.imageUrlPublicId)
          )
        );
      }
    }

    // 10. Cập nhật ElasticSearch (sau khi commit thành công)
    if (priceChanged) {
      try {
        await client.update({
          index: "products",
          id: productId.toString(),
          doc: {
            price: product.price, // Chỉ cần update price
          },
        });
      } catch (esError) {
        console.error("ElasticSearch update failed:", esError);
      }
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật sản phẩm biến thể thành công",
      data: productVariant,
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  } finally {
    await session.endSession();
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

  const { productVariantId } = req.params; // destructuring

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Tìm sp biến thể
    const productVariant = await ProductVariant.findById(
      productVariantId
    ).session(session);
    if (!productVariant) {
      await session.abortTransaction();
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm biến thể không tồn tại",
      });
    }

    const productId = productVariant.productId;
    const oldPrice = productVariant.sellingPrice;

    // 2. Lấy thông tin để backup (trước khi xóa)
    const variantImages = await VariantImage.find({ productVariantId }).session(
      session
    );
    const product = await Product.findById(productId).session(session);

    // 3. Thực hiện xóa trong transaction
    await ProductVariant.findByIdAndDelete(productVariantId).session(session);
    await VariantAttribute.deleteMany({ productVariantId }).session(session);
    await VariantImage.deleteMany({ productVariantId }).session(session);
    await Inventory.findOneAndDelete({ productVariantId }).session(session);

    // Xóa cartItem đang tham chiếu đến biến thể
    await CartItem.deleteMany({ productVariantId }).session(session);

    // 4. Cập nhật lại giá sản phẩm gốc
    const allVariants = await ProductVariant.find({
      productId,
      isActive: true,
    }).session(session);

    let newPrice = 0;
    if (allVariants.length > 0) {
      newPrice = Math.min(
        ...allVariants.map((variant) => variant.sellingPrice)
      );
    } else {
      // Không còn biến thể nào - cần xử lý
      newPrice = 0; // hoặc null, hoặc set product status = false
    }

    await Product.findByIdAndUpdate(
      productId,
      { price: newPrice },
      { session }
    );

    // 5. Commit transaction - MongoDB
    await session.commitTransaction();

    // 6. Xóa ảnh trên Cloudinary (sau khi commit thành công)
    // Đây là operation bên ngoài, không nằm trong transaction
    if (variantImages.length > 0) {
      await Promise.all(
        variantImages.map((image) =>
          cloudinary.uploader.destroy(image.imageUrlPublicId)
        )
      );
    }

    // 7. Cập nhật ElasticSearch (sau khi commit thành công)
    try {
      await client.update({
        index: "products",
        id: productId.toString(),
        doc: {
          price: newPrice, // Chỉ update price, không cần update toàn bộ
        },
      });
    } catch (esError) {
      console.error("ElasticSearch update failed:", esError);
      // Không rollback vì MongoDB đã thành công
      // Có thể ghi log và xử lý sau (retry queue)
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa sản phẩm biến thể thành công",
    });
  } catch (error) {
    // Rollback tự động khi có lỗi
    await session.abortTransaction();

    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  } finally {
    session.endSession();
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
    inventory.quantity = Number(newQuantity) + inventory.reversed;
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

const updateStatusProductVariant = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const productVariantId = req.params.productVariantId;
  if (!mongoose.Types.ObjectId.isValid(productVariantId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm biến thể không hợp lệ",
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

    // 2. Lấy trạng thái hiện tại của biến thể
    const currentStatus = productVariant.isActive;

    // 3. Cập nhật trạng thái ngược lại
    productVariant.isActive = !currentStatus;
    await productVariant.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: currentStatus ? "Đã tắt sản phẩm" : "Đã bật sản phẩm",
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

const deleteUploadedFile = async (files) => {
  if (files.length > 0) {
    await Promise.all(
      files.map(async (file) => {
        await cloudinary.uploader.destroy(file.filename);
      })
    );
  }
};

module.exports = {
  addProductVariant,
  updateProductVariant,
  deleteProductVariant,
  updateInventory,
  updateStatusProductVariant,
};
