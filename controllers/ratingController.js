const Rating = require("../models/rating");
const Product = require("../models/product");
const User = require("../models/user");
const { getIO } = require("../config/socket");
const mongoose = require("mongoose");
const client = require("../config/elasticsearch");

const postRatingProduct = async (req, res) => {
  const userId = req.user.userId;
  const { productId, stars } = req.body;

  // Validate input
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  if (!stars || stars < 1 || stars > 5 || !Number.isInteger(Number(stars))) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Số sao phải là số nguyên từ 1 đến 5",
    });
  }

  try {
    // Lấy user + product song song
    const [user, product] = await Promise.all([
      User.findById(userId).select("fullName avatar"),
      Product.findById(productId),
    ]);

    if (!user || !product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: !user ? "Người dùng không tồn tại" : "Sản phẩm không tồn tại",
      });
    }

    // Tìm rating cũ
    let rating = await Rating.findOne({
      userId,
      productId: product._id,
    });

    let ratingData;
    const isUpdate = !!rating;

    if (isUpdate) {
      // Update rating cũ
      rating.stars = Number(stars);
      rating.updatedAt = new Date();
      await rating.save();
      ratingData = rating;
    } else {
      // Tạo mới rating
      const newRating = await Rating.create({
        productId: product._id,
        userId,
        stars: Number(stars),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      ratingData = newRating;
    }

    // Tính lại rating trung bình
    const stats = await Rating.aggregate([
      { $match: { productId: product._id } },
      {
        $group: {
          _id: "$productId",
          averageStars: { $avg: "$stars" },
        },
      },
    ]);

    const averageStars = stats[0]?.averageStars || 0;

    // ===== Sau khi lưu DB =====

    // Cập nhật Elasticsearch
    client
      .update({
        index: "products",
        id: String(productId),
        body: {
          doc: {
            averageStars: parseFloat(averageStars.toFixed(2)),
          },
        },
      })
      .catch((e) => console.error("Elasticsearch update failed:", e));

    // Emit socket
    const io = getIO();
    io.emit("newRating", {
      _id: ratingData._id,
      productId: ratingData.productId,
      userId,
      fullName: user.fullName,
      avatar: user.avatar,
      stars: ratingData.stars,
      createdAt: ratingData.createdAt,
      updatedAt: ratingData.updatedAt,
    });

    return res.status(isUpdate ? 200 : 201).json({
      status: "success",
      code: isUpdate ? 200 : 201,
      message: isUpdate
        ? "Cập nhật đánh giá thành công"
        : "Đánh giá sản phẩm thành công",
      data: {
        ...ratingData.toObject(),
        fullName: user.fullName,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Lỗi đánh giá sản phẩm:", error);

    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống khi đánh giá sản phẩm",
    });
  }
};

const getAllRatingsByProduct = async (req, res) => {
  const { productId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  try {
    const ratings = await Rating.aggregate([
      {
        $match: { productId: new mongoose.Types.ObjectId(productId) },
      },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },

      {
        $addFields: {
          avatar: { $arrayElemAt: ["$userInfo.avatar", 0] },
          fullName: { $arrayElemAt: ["$userInfo.fullName", 0] },
        },
      },

      {
        $project: {
          userInfo: 0, // ẩn trường userInfo trung gian
        },
      },

      {
        $sort: {
          createdAt: -1,
        },
      },

      { $skip: skip },
      { $limit: limit },
    ]);

    const totalRatings = await Rating.countDocuments({ productId });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách đánh giá sao",
      data: ratings,
      pagination: {
        page,
        limit,
        totalRatings,
        totalPages: Math.ceil(totalRatings / limit),
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

const getSummaryRatingForProduct = async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  try {
    // Ktra product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm không tồn tại",
      });
    }

    const starsRating = await Rating.aggregate([
      {
        $match: { productId: new mongoose.Types.ObjectId(productId) },
      },
      {
        $group: {
          _id: "$stars",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          stars: "$_id",
          count: 1,
        },
      },
      {
        $sort: { stars: -1 },
      },
    ]);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy tổng số lượng đánh giá cho từng số sao",
      data: starsRating,
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
  postRatingProduct,
  getAllRatingsByProduct,
  getSummaryRatingForProduct,
};
