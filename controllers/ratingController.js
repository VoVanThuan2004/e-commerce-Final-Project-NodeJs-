const Rating = require("../models/rating");
const Product = require("../models/product");
const User = require("../models/user");
const { getIO } = require("../config/socket");
const mongoose = require("mongoose");
const client = require("../config/elasticsearch");

const postRatingProduct = async (req, res) => {
  const userId = req.user.userId;

  const { productId, stars } = req.body;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  if (stars > 5 || stars < 1) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Số sao không hợp lệ",
    });
  }

  const session = await mongoose.startSession();

  try {
    await session.startTransaction();
    
    // Kiểm tra user & product
    const [user, product] = await Promise.all([
      User.findById(userId).session(session),
      Product.findById(productId).session(session),
    ]);
    if (!user) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Người dùng không tồn tại",
      });
    }
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm không tồn tại",
      });
    }

    // Tạo rating
    const rating = await Rating.create([{ productId, userId, stars }], {
      session,
    });
    const newRating = rating[0];

    // Tính tổng lại trung bình rating của sản phẩm
    const stats = await Rating.aggregate([
      {
        $match: { productId: new mongoose.Types.ObjectId(productId) },
      },
      {
        $group: {
          _id: "$productId",
          averageStars: { $avg: "$stars" },
        },
      },
    ]).session(session);

    const { averageStars } = stats[0] || { averageStars: 0 };

    await session.commitTransaction();
    session.endSession();

    // Cập nhật lên Elastic search
    await client.update({
      index: "products",
      id: product._id.toString(),
      doc: {
        averageStars,
      },
    });

    // Gửi qua socket
    const io = getIO();
    io.emit("newRating", {
      _id: newRating._id,
      productId: newRating.productId,
      userId,
      fullName: user.fullName,
      avatar: user.avatar,
      stars: newRating.stars,
      createdAt: newRating.createdAt,
      updatedAt: newRating.updatedAt,
    });

    return res.status(201).json({
      status: "success",
      code: 201,
      message: "Đánh giá sao cho sản phẩm thành công",
      data: {
        _id: newRating._id,
        productId: newRating.productId,
        userId,
        fullName: user.fullName,
        avatar: user.avatar,
        stars: newRating.stars,
        createdAt: newRating.createdAt,
        updatedAt: newRating.updatedAt,
      },
    });
  } catch (error) {
    // Kiểm tra xem transaction có đang active không trước khi abort
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
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
