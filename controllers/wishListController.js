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

  try {
    const products = await WishList.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
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
                description: 1,
                defaultImage: 1,
              },
            },
          ],
          as: "product"
        },
      },

      {
        $sort: {
          createdAt: -1
        }
      },

      {
        $replaceRoot: {
          newRoot: { $arrayElemAt: ["$product", 0] },
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách sản phẩm trong danh mục yêu thích",
      data: products,
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
  addToWishlist,
  deleteProductOutWishList,
  getAllProductsInWishList,
};
