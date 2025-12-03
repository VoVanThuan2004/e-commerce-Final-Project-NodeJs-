const Product = require("../models/product");
const Brand = require("../models/brand");
const Category = require("../models/category");
const ProductVariant = require("../models/productVariant");
const VariantAttribute = require("../models/variantAttribute");
const Inventory = require("../models/inventory");
const client = require("../config/elasticsearch");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const VariantImage = require("../models/variantImage");

const addProduct = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    await cloudinary.uploader.destroy(req.file.filename);
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { brandId, categoryId, name, description } = req.body;
  if (!brandId || !categoryId || !name || !description) {
    await cloudinary.uploader.destroy(req.file.filename);
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
      await cloudinary.uploader.destroy(req.file.filename);
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Thương hiệu không tồn tại",
      });
    }

    // Kiểm tra category
    const category = await Category.findById(categoryId);
    if (!category) {
      await cloudinary.uploader.destroy(req.file.filename);
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
      status: true,
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
          status: product.status,
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

      console.log(
        "Lỗi khi thêm sản phẩm lên Elastic Search: " + eserror.message
      );
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
    await deleteUploadedFile(req.file);
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const productId = req.params.productId;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    await deleteUploadedFile(req.file);
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  const { brandId, categoryId, name, description } = req.body;
  if (!brandId || !categoryId || !name || !description) {
    await deleteUploadedFile(req.file);
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
      await deleteUploadedFile(req.file);
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Thương hiệu không tồn tại",
      });
    }

    // Kiểm tra category
    const category = await Category.findById(categoryId);
    if (!category) {
      await deleteUploadedFile(req.file);
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Danh mục không tồn tại",
      });
    }

    // Lấy product đang tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      await deleteUploadedFile(req.file);
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
          status: product.status,
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
    // Xây dựng query với filter status = true
    let esQuery;

    if (q) {
      esQuery = {
        bool: {
          must: [
            {
              multi_match: {
                query: q,
                fields: ["name"],
                fuzziness: "AUTO",
              },
            },
          ],
        },
      };
    } else {
      esQuery = {
        bool: {
          must: [{ match_all: {} }],
        },
      };
    }

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
        "status",
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
  const { q, brandId, categoryId, minPrice, maxPrice, stars, by, sort } =
    req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const must = [];

  must.push({ term: { status: true } });

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

  if (stars) {
    must.push({
      term: { averageStars: stars },
    });
  }

  // Nếu có nhập search
  // Search chỉ trên field name
  if (q && q.trim()) {
    const searchQuery = q.trim();

    must.push({
      bool: {
        should: [
          // Ưu tiên kết quả khớp chính xác nhất
          {
            match_phrase: {
              name: {
                query: searchQuery,
                boost: 3,
              },
            },
          },
          // Tìm kiếm với fuzzy matching
          {
            match: {
              name: {
                query: searchQuery,
                fuzziness: "AUTO",
                operator: "and", // yêu cầu tất cả từ phải khớp
                boost: 2,
              },
            },
          },
        ],
      },
    });
  }

  // Kết hợp với sort product trong filter
  // Xử lý sắp xếp
  const sortField = by === "price" ? "price" : "name.keyword"; // default: name
  const sortOrder = sort === "desc" ? "desc" : "asc";

  try {
    const result = await client.search({
      index: "products",
      from: skip,
      size: limit,
      query: { bool: { must } },
      sort: [{ [sortField]: sortOrder }],
      _source: [
        "name",
        "price",
        "defaultImage",
        "brandId",
        "categoryId",
        "status",
        "averageStars",
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

const filterProductAdmin = async (req, res) => {
  const { q, brandId, categoryId, minPrice, maxPrice, by, sort } = req.query;
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

  // Nếu có nhập search
  // Search chỉ trên field name
  if (q && q.trim()) {
    const searchQuery = q.trim();

    must.push({
      bool: {
        should: [
          // Ưu tiên kết quả khớp chính xác nhất
          {
            match_phrase: {
              name: {
                query: searchQuery,
                boost: 3,
              },
            },
          },
          // Tìm kiếm với fuzzy matching
          {
            match: {
              name: {
                query: searchQuery,
                fuzziness: "AUTO",
                operator: "and", // yêu cầu tất cả từ phải khớp
                boost: 2,
              },
            },
          },
        ],
      },
    });
  }

  // Kết hợp với sort product trong filter
  // Xử lý sắp xếp
  const sortField = by === "price" ? "price" : "name.keyword"; // default: name
  const sortOrder = sort === "desc" ? "desc" : "asc";

  try {
    const result = await client.search({
      index: "products",
      from: skip,
      size: limit,
      query: { bool: { must } },
      sort: [{ [sortField]: sortOrder }],
      _source: [
        "name",
        "price",
        "defaultImage",
        "brandId",
        "categoryId",
        "status",
        "description",
        "averageStars",
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
        "status",
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
    const productVariants = await ProductVariant.find({
      productId,
    }).select(
      "_id name originalPrice sellingPrice isActive createdAt updatedAt weight width height length"
    );

    // 3. Map thêm attribute cho từng biến thể
    const variantWithAttrs = await Promise.all(
      productVariants.map(async (variant) => {
        // Lấy ảnh của sản phẩm biến thể
        const variantImages = await VariantImage.find({
          productVariantId: variant._id,
        }).select("imageUrl");
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
          images: variantImages,
          quantity: inventory.quantity - inventory.reversed,
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

const viewDetailProductAdmin = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy sản phẩm",
      });
    }

    const variants = await ProductVariant.find({
      productId,
      isActive: true,
    }).lean();

    if (variants.length === 0) {
      return res.json({
        status: "success",
        data: {
          product: { _id: product._id, name: product.name },
          variants: [],
        },
      });
    }

    const variantIds = variants.map((v) => v._id);

    const [images, variantAttrs, inventories] = await Promise.all([
      VariantImage.find({ productVariantId: { $in: variantIds } }).lean(),
      VariantAttribute.find({ productVariantId: { $in: variantIds } })
        .populate({
          path: "attributeValueId",
          populate: { path: "attributeId", select: "attributeName" },
        })
        .lean(),
      Inventory.find({ productVariantId: { $in: variantIds } })
        .select("productVariantId quantity reversed")
        .lean(),
    ]);

    // Nhóm dữ liệu
    const imagesMap = images.reduce((acc, img) => {
      (acc[img.productVariantId] ||= []).push({
        _id: img._id,
        imageUrl: img.imageUrl,
      });
      return acc;
    }, {});

    const attrsMap = variantAttrs.reduce((acc, va) => {
      (acc[va.productVariantId] ||= []).push({
        attributeId: va.attributeValueId.attributeId._id,
        attribute: va.attributeValueId.attributeId.attributeName,
        valueId: va.attributeValueId._id,
        value: va.attributeValueId.value,
      });
      return acc;
    }, {});

    // Tính tồn kho thực tế: quantity - reserved
    const inventoryMap = inventories.reduce((acc, inv) => {
      acc[inv.productVariantId] = Math.max(
        0,
        (inv.quantity || 0) - (inv.reversed || 0)
      );
      return acc;
    }, {});

    // GỢI Ý: Nếu có biến thể chưa có bản ghi Inventory → mặc định 0
    const formattedVariants = variants.map((v) => ({
      _id: v._id,
      name: v.name,
      originalPrice: v.originalPrice,
      sellingPrice: v.sellingPrice,
      quantity: inventoryMap[v._id] ?? 0, // ← ĐÚNG RỒI, DÙNG TỒN KHO TỪ INVENTORY
      weight: v.weight || 0,
      width: v.width || 0,
      height: v.height || 0,
      length: v.length || 0,
      isActive: v.isActive,
      images: imagesMap[v._id] || [],
      attributes: attrsMap[v._id] || [],
    }));

    return res.json({
      status: "success",
      data: {
        product: { _id: product._id, name: product.name },
        variants: formattedVariants,
      },
    });
  } catch (error) {
    console.error("Error in viewDetailProductAdmin:", error);
    return res.status(500).json({
      status: "error",
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
          as: "variantAttributes",
        },
      },
      {
        $unwind: "$variantAttributes",
      },
      {
        $lookup: {
          from: "attributevalues",
          localField: "variantAttributes.attributeValueId",
          foreignField: "_id",
          as: "attrValue",
        },
      },
      {
        $unwind: "$attrValue",
      },
      {
        $lookup: {
          from: "attributes",
          localField: "attrValue.attributeId",
          foreignField: "_id",
          as: "attr",
        },
      },
      {
        $unwind: "$attr",
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
              attribute: "$attr.attribute_name",
            },
          },
        },
      },

      // Filter: phải đủ số lượng attrIds và chứa đúng tất cả attrIds client gửi
      {
        $match: {
          $expr: { $eq: [{ $size: "$attributes" }, attrIds.length] },
          "attributes.valueId": {
            $all: attrIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      },

      // Join images
      {
        $lookup: {
          from: "variantimages",
          localField: "_id",
          foreignField: "productVariantId",
          as: "images",
        },
      },
      {
        $project: {
          name: 1,
          sellingPrice: 1,
          originalPrice: 1,
          isActive: 1,
          productId: 1,
          attributes: 1,
          images: { imageUrl: 1 }, // chỉ lấy imageUrl
        },
      },

      // Join inventory và chỉ lấy quantity
      {
        $lookup: {
          from: "inventories",
          localField: "_id",
          foreignField: "productVariantId",
          as: "inventory",
        },
      },
      {
        $addFields: {
          quantity: {
            $ifNull: [{ $arrayElemAt: ["$inventory.quantity", 0] }, 0],
          },
        },
      },
      {
        $project: { inventory: 0 }, // bỏ luôn inventory array
      },
    ]);

    if (variants.length === 0) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Không tìm thấy biến thể với các thuộc tính đã chọn",
      });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy biến thể sản phẩm thành công",
      data: variants[0],
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// Cập nhật trạng thái product
const updateStatusProduct = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên",
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

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Sản phẩm không tồn tại",
      });
    }

    // Lấy trạng thái hiện tại
    const currentStatus = product.status;
    product.status = !currentStatus;
    await product.save();

    // Cập nhật lại trạng thái product trên ElasticSearch
    try {
      await client.update({
        index: "products",
        id: product._id.toString(),
        doc: {
          status: product.status,
        },
      });
    } catch (error) {
      await Product.findByIdAndUpdate(product._id, {
        $set: { status: currentStatus },
      });
      return res.status(500).json({
        status: "error",
        code: 500,
        message:
          "Lỗi khi cập nhật trạng thái sản phẩm trên Elastic Search: " +
          error.message,
      });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: currentStatus ? "Đã tắt sản phẩm" : "Đã bật sản phẩm",
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

const deleteProduct = async (req, res) => {
  const productId = req.params.productId;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm không tồn tại",
      });
    }

    // Kiểm tra xem product hiện tại có biến thể tham chiếu không -> nếu có -> không cho xóa
    const productVariant = await ProductVariant.findOne({ productId });
    if (productVariant) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message:
          "Không thể xóa sản phẩm, vì hiện tại sản phẩm có các biến thể sản phẩm đang tồn tại",
      });
    }

    // Xóa ảnh trên Cloudinary (nếu có)
    if (product.defaultImagePublicId) {
      try {
        await cloudinary.uploader.destroy(product.defaultImagePublicId);
      } catch (err) {
        console.warn("Không thể xóa ảnh trên Cloudinary:", err.message);
      }
    }

    // Xóa trên Elasticsearch
    try {
      await client.delete({
        index: "products",
        id: productId.toString(),
      });
    } catch (esError) {
      console.warn(
        "Không thể xóa sản phẩm trên Elasticsearch:",
        esError.message
      );
    }

    // Xóa trong MongoDB
    await Product.findByIdAndDelete(productId);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa sản phẩm thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getProductHomePage = async (req, res) => {
  try {
    const result = await client.search({
      index: "products",
      from: 0,
      size: 8,
      _source: [
        "name",
        "price",
        "defaultImage",
        "brandId",
        "categoryId",
        "status",
        "averageStars",
      ],
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
    }));

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy các sản phẩm cho trang chủ",
      data: hits,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getProductSameCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await client.search({
      index: "products",
      from: 0,
      size: 10,
      query: {
        term: {
          categoryId: categoryId,
        },
      },
      _source: [
        "name",
        "price",
        "defaultImage",
        "brandId",
        "categoryId",
        "status",
        "averageStars",
      ],
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...hit._source,
    }));

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy các sản phẩm cho trang chủ",
      data: hits,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

// Function xóa ảnh upload cloudinary
const deleteUploadedFile = async (file) => {
  if (file && file.filename) {
    await cloudinary.uploader.destroy(file.filename);
  }
};

module.exports = {
  addProduct,
  updateProduct,
  searchProduct,
  suggestProduct,
  filterProduct,
  filterProductAdmin,
  sortProduct,
  viewDetailProduct,
  viewDetailProductAdmin,
  chooseProductVariant,
  updateStatusProduct,
  deleteProduct,
  getProductHomePage,
  getProductSameCategory,
};
