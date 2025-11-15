const WishList = require("../models/wishlist");
const User = require("../models/user");
const Product = require("../models/product");
const mongoose = require("mongoose");

const addToWishlist = async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.body;
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(productId)
  ) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID người dùng hoặc ID sản phẩm không hợp lệ",
    });
  }

  try {
    // Ktra user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    // Ktra product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm không tồn tại",
      });
    }

    // Thêm wishlist
    await WishList.create({
      userId,
      productId,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Thêm sản phẩm vào danh sách yêu thích thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const deleteProductOutWishList = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.userId;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(productId)
  ) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID người dùng hoặc ID sản phẩm không hợp lệ",
    });
  }

  try {
    // Ktra user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }

    // Ktra product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm không tồn tại",
      });
    }

    // Xóa sản phẩm khỏi danh sách wishlist
    await WishList.findOneAndDelete({ userId, productId });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa sản phẩm ra khỏi danh sách yêu thích",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getAllProductsInWishList = async (req, res) => {
  const userId = req.user.userId;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID người dùng không hợp lệ",
    });
  }

  let { page, limit } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;

  const skip = (page - 1) * limit;

  try {
    const products = await WishList.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },

      // JOIN Product
      {
        $lookup: {
          from: "products",
          let: { pid: "$productId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$pid"] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                price: 1,
                defaultImage: 1,
              },
            },
          ],
          as: "product",
        },
      },

      // JOIN Rating
      {
        $lookup: {
          from: "ratings",
          let: { pid: "$productId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$productId", "$$pid"] } } },
            {
              $group: {
                _id: "$productId",
                averageStars: { $avg: "$stars" },
              },
            },
          ],
          as: "rating",
        },
      },

      // Sort theo thời gian wishlist
      {
        $sort: { createdAt: -1 },
      },

      { $skip: skip },
      { $limit: limit },

      // Gộp product + rating vào 1 object
      {
        $project: {
          product: { $arrayElemAt: ["$product", 0] },
          rating: { $arrayElemAt: ["$rating", 0] },
        },
      },

      // Trả ra format final
      {
        $project: {
          _id: "$product._id",
          name: "$product.name",
          price: "$product.price",
          defaultImage: "$product.defaultImage",
          averageStars: "$rating.averageStars",
        },
      },
    ]);

    const totalWishLists = await WishList.countDocuments({ userId });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách sản phẩm trong danh mục yêu thích",
      data: products,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalWishLists / limit),
        totalWishLists,
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

const checkWishList = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.userId;

  // 1. Kiểm tra product,
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      status: "error",
      code: 404,
      message: "Sản phẩm không tồn tại",
    });
  }

  const wishlist = await WishList.findOne({ userId, productId });

  // 2. Nếu sản phẩm đã thêm wishlist -> true. Ngược lại -> false
  if (!wishlist) {
    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Sản phẩm chưa thêm vào danh sách yêu thích",
      data: false,
    });
  }

  return res.status(200).json({
    status: "success",
    code: 200,
    message: "Sản phẩm đã thêm vào danh sách yêu thích",
    data: true,
  });
};

module.exports = {
  addToWishlist,
  deleteProductOutWishList,
  getAllProductsInWishList,
  checkWishList,
};
