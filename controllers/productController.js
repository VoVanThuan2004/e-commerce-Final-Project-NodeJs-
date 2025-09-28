const Product = require("../models/product");
const Brand = require("../models/brand");
const Category = require("../models/category");
const ProductVariant = require("../models/productVariant");
const VariantAttribute = require("../models/variantAttribute");
const AttributeValue = require("../models/attributeValue");
const Inventory = require("../models/inventory");
const client = require("../config/elasticsearch");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

const addProduct = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { brandId, categoryId, name, description } = req.body;
  if (!brandId || !categoryId || !name || !description) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập đầy đủ thông tin cho sản phẩm",
    });
  }

  // Kiểm tra phải có gửi ảnh
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng upload ảnh cho sản phẩm",
    });
  }

  try {
    // Kiểm tra brand
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Thương hiệu không tồn tại",
      });
    }

    // Kiểm tra category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Danh mục không tồn tại",
      });
    }

    // Thêm product vào MongoDB
    const product = await Product.create({
      brandId,
      categoryId,
      name,
      description,
      defaultImage: req.file.path,
      defaultImagePublicId: req.file.filename,
    });

    // Thêm product vào Elasticsearch
    try {
      await client.index({
        index: "products",
        id: product._id.toString(),
        document: {
          brandId: brandId,
          categoryId: categoryId,
          name: product.name,
          price: product.price,
          description: product.description,
          defaultImage: product.defaultImage,
          defaultImagePublicId: product.defaultImagePublicId,
          suggest: {
            input: [product.name],
            weight: 10,
          },
        },
      });

      return res.status(201).json({
        status: "success",
        code: 201,
        message: "Thêm sản phẩm gốc thành công",
        data: product,
      });
    } catch (eserror) {
      // Nếu elastichsearch lỗi -> xóa product trong DB
      await Product.findByIdAndDelete(product._id);

      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Lỗi khi thêm sản phẩm: " + eserror.message,
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const productId = req.params.productId;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  const { brandId, categoryId, name, description } = req.body;
  if (!brandId || !categoryId || !name || !description) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập đầy đủ thông tin cho sản phẩm",
    });
  }

  try {
    // Kiểm tra brand
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Thương hiệu không tồn tại",
      });
    }

    // Kiểm tra category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Danh mục không tồn tại",
      });
    }

    // Lấy product đang tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm gốc không tồn tại",
      });
    }

    // Lưu lại dữ liệu cũ để rollback nếu cần
    const oldProductData = product.toObject();

    // Cập nhật product vào DB
    product.brandId = brandId;
    product.categoryId = categoryId;
    product.name = name;
    product.description = description;

    if (req.file) {
      if (product.defaultImagePublicId != null) {
        // Xóa ảnh cũ
        await cloudinary.uploader.destroy(product.defaultImagePublicId);
      }

      product.defaultImage = req.file.path;
      product.defaultImagePublicId = req.file.filename;
    }
    await product.save();

    // Cập nhật product vào Elasticsearch
    try {
      await client.update({
        index: "products",
        id: product._id.toString(),
        doc: {
          brandId: product.brandId,
          categoryId: product.categoryId,
          name: product.name,
          price: product.price,
          description: product.description,
          defaultImage: product.defaultImage,
          defaultImagePublicId: product.defaultImagePublicId,
          suggest: {
            input: [product.name],
            weight: 10,
          },
        },
      });
    } catch (eserror) {
      // Rollback MongoDB về dữ liệu cũ
      await Product.findByIdAndUpdate(product._id, oldProductData);

      return res.status(500).json({
        status: "error",
        code: 500,
        message: "Lỗi khi cập nhật",
      });
    }

    // Thành công
    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật sản phẩm thành công",
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const searchProduct = async (req, res) => {
  const q = req.query.q;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  try {
    // Nếu q (nhập search) thì tìm kiếm theo q, ngược lại query tất cả
    const esQuery = q
      ? {
          multi_match: {
            query: q,
            fields: ["name"], // name có trọng số cao hơn
            fuzziness: "AUTO", // cho phép tìm gần đúng
          },
        }
      : { match_all: {} };

    const result = await client.search({
      index: "products",
      from: skip,
      size: limit,
      query: esQuery,
      _source: [
        "name",
        "price",
        "description",
        "defaultImage",
        "brandId",
        "categoryId",
      ], // chỉ lấy các field này
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
    }));

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Tìm kiếm sản phẩm thành công",
      data: hits,
      pagination: {
        total: result.hits.total.value,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.hits.total.value / limit),
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

const suggestProduct = async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập từ khóa để gợi ý",
    });
  }

  try {
    const result = await client.search({
      index: "products",
      size: 0,
      suggest: {
        product_suggest: {
          prefix: q,
          completion: {
            field: "suggest",
            fuzzy: {
              fuzziness: 2, // cho phép sai 2 ký tự
            },
            size: 5, // trả về tối đa 5 gợi ý
          },
        },
      },
    });

    const options = result.suggest.product_suggest[0].options.map((opt) => ({
      id: opt._id,
      name: opt._source?.name,
    }));

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Gợi ý sản phẩm thành công",
      data: options,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const filterProduct = async (req, res) => {
  const { brandId, categoryId, minPrice, maxPrice } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const must = [];

  if (brandId) {
    must.push({
      term: { brandId: brandId },
    });
  }
  if (categoryId) {
    must.push({
      term: { categoryId: categoryId },
    });
  }
  if (minPrice || maxPrice) {
    must.push({
      range: { price: { gte: minPrice || 0, lte: maxPrice || 1000000 } },
    });
  }

  try {
    const result = await client.search({
      index: "products",
      from: skip,
      size: limit,
      query: { bool: { must } },
      _source: [
        "name",
        "price",
        "description",
        "defaultImage",
        "brandId",
        "categoryId",
      ], // chỉ lấy các field này
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
    }));

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lọc sản phẩm thành công",
      data: hits,
      pagination: {
        total: result.hits.total.value,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.hits.total.value / limit),
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

const sortProduct = async (req, res) => {
  const by = req.query.by || "name";
  const sort = req.query.sort || "asc";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!by || !sort) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin sắp xếp, chọn loại sắp xếp",
    });
  }

  const querySort = [];

  if (by === "name") {
    querySort.push({
      "name.keyword": sort,
    });
  }

  if (by === "price") {
    querySort.push({
      price: sort,
    });
  }

  try {
    const result = await client.search({
      index: "products",
      from: skip,
      size: limit,
      sort: querySort,
      _source: [
        "name",
        "price",
        "description",
        "defaultImage",
        "brandId",
        "categoryId",
      ], // chỉ lấy các field này
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
    }));

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Sắp xếp sản phẩm thành công",
      data: hits,
      pagination: {
        total: result.hits.total.value,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.hits.total.value / limit),
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

// API xem chi tiết sản phẩm
const viewDetailProduct = async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  try {
    // 1. Tìm product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm không tồn tại",
      });
    }

    // 2. Lấy ra danh sách biến thể của product
    const productVariants = await ProductVariant.find({ productId }).select(
      "_id name sellingPrice isActive"
    );

    // 3. Map thêm attribute cho từng biến thể
    const variantWithAttrs = await Promise.all(
      productVariants.map(async (variant) => {
        const variantAttributes = await VariantAttribute.find({
          productVariantId: variant._id,
        }).populate({
          path: "attributeValueId",
          populate: {
            path: "attributeId",
            options: { sort: { order: 1 } }, // sort theo order
          },
        });

        const formattedAttrs = variantAttributes.map((a) => ({
          attribute: a.attributeValueId.attributeId.attributeName,
          value: a.attributeValueId.value,
          valueId: a.attributeValueId._id,
        }));

        // Lấy tồn kho từng biến thể
        const inventory = await Inventory.findOne({
          productVariantId: variant._id,
        });

        return {
          ...variant.toObject(),
          quantity: inventory.quantity,
          attributes: formattedAttrs,
        };
      })
    );

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xem thông tin chi tiết sản phẩm",
      data: {
        description: product.description,
        variants: variantWithAttrs,
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

// API chọn sản phẩm biến thể
const chooseProductVariant = async (req, res) => {
  const { productId } = req.params;
  const { attributeValueIds } = req.query;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  const attrIds = Array.isArray(attributeValueIds)
    ? attributeValueIds
    : [attributeValueIds];

  try {
    const variants = await ProductVariant.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },

      // Join VariantAttributes + AttributeValues + Attributes
      {
        $lookup: {
          from: "variantattributes",
          localField: "_id",
          foreignField: "productVariantId",
          as: "variantAttributes"
        }
      },
      {
        $unwind: "$variantAttributes"
      },
      {
        $lookup: {
          from: "attributevalues",
          localField: "variantAttributes.attributeValueId",
          foreignField: "_id",
          as: "attrValue"
        }
      },
      {
        $unwind: "$attrValue"
      },
      {
        $lookup: {
          from: "attributes",
          localField: "attrValue.attributeId",
          foreignField: "_id",
          as: "attr"
        }
      },
      {
        $unwind: "$attr"
      },

      // Gom lại thành attributes array
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          sellingPrice: { $first: "$sellingPrice" },
          isActive: { $first: "$isActive" },
          productId: { $first: "$productId" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },
          attributes: {
            $push: {
              valueId: "$attrValue._id",
              value: "$attrValue.value",
              attribute: "$attr.attribute_name"
            }
          }
        }
      },

      // Filter: phải đủ số lượng attrIds và chứa đúng tất cả attrIds client gửi
      {
        $match: {
          $expr: { $eq: [ { $size: "$attributes" }, attrIds.length ] },
          "attributes.valueId": {
            $all: attrIds.map(id => new mongoose.Types.ObjectId(id))
          }
        }
      },

      // Join images
      {
        $lookup: {
          from: "variantimages",
          localField: "_id",
          foreignField: "productVariantId",
          as: "images"
        }
      },
      {
        $project: {
          name: 1,
          sellingPrice: 1,
          originalPrice: 1,
          isActive: 1,
          productId: 1,
          attributes: 1,
          images: { imageUrl: 1 } // chỉ lấy imageUrl
        }
      },

      // Join inventory và chỉ lấy quantity
      {
        $lookup: {
          from: "inventories",
          localField: "_id",
          foreignField: "productVariantId",
          as: "inventory"
        }
      },
      {
        $addFields: {
          quantity: { $ifNull: [ { $arrayElemAt: ["$inventory.quantity", 0] }, 0 ] }
        }
      },
      {
        $project: { inventory: 0 } // bỏ luôn inventory array
      }
    ]);

    if (variants.length === 0) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Không tìm thấy biến thể với các thuộc tính đã chọn"
      });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy biến thể sản phẩm thành công",
      data: variants[0]
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
  addProduct,
  updateProduct,
  searchProduct,
  suggestProduct,
  filterProduct,
  sortProduct,
  viewDetailProduct,
  chooseProductVariant,
};
