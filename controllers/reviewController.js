const Review = require("../models/review");
const ImageReview = require("../models/imageReview");
const Product = require("../models/product");
const User = require("../models/user");
const mongoose = require("mongoose");
const { getIO } = require("../config/socket");
const cloudinary = require("../config/cloudinary");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const postReview = async (req, res) => {
  const SECRET_KEY = process.env.SECRET_KEY;
  const authHeader = req.headers.authorization;
  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, SECRET_KEY);
  req.user = decoded;

  const userId = req.user ? req.user.userId : null;

  // TH1. Không đăng nhập
  if (userId === null) {
    const { productId, message, fullName } = req.body;
    if (!productId || !message || !fullName) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Vui lòng nhập đầy đủ thông tin",
      });
    }

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

      // Tạo review
      const review = await Review.create({
        productId,
        message,
        userId,
        fullName,
      });

      // Upload ảnh nếu có
      let imagesUrl = [];
      if (req.files && req.files.length > 0) {
        const imageReviews = req.files.map((f) => ({
          reviewId: review._id,
          imageUrl: f.path,
          imageUrlPublicId: f.filename,
        }));

        const savedImages = await ImageReview.insertMany(imageReviews);
        imagesUrl = savedImages.map((img) => img.imageUrl);
      }

      // Kết nối đến socket
      const io = getIO();
      io.emit("newReview", {
        review,
        imagesUrl,
      });

      return res.status(201).json({
        status: "success",
        code: 201,
        message: "Đánh giá sản phẩm thành công",
        data: {
          review,
          imagesUrl,
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        code: 500,
        message: "Lỗi hệ thống: " + error.message,
      });
    }
  }

  // TH2. Có đăng nhập
  else {
    const { productId, message } = req.body;
    if (!productId || !message) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Vui lòng nhập đầy đủ thông tin",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "ID sản phẩm không hợp lệ",
      });
    }

    try {
      // Ktra user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: "error",
          code: 404,
          message: "Người dùng không hợp lệ",
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

      // Tạo review
      const review = await Review.create({
        productId,
        message,
        userId,
      });

      // Upload ảnh nếu có
      let imagesUrl = [];
      if (req.files && req.files.length > 0) {
        const imageReviews = req.files.map((f) => ({
          reviewId: review._id,
          imageUrl: f.path,
          imageUrlPublicId: f.filename,
        }));

        const savedImages = await ImageReview.insertMany(imageReviews);
        imagesUrl = savedImages.map((img) => img.imageUrl);
      }

      // Kết nối đến socket
      const io = getIO();
      io.emit("newReview", {
        review,
        imagesUrl,
      });

      return res.status(201).json({
        status: "success",
        code: 201,
        message: "Đánh giá sản phẩm thành công",
        data: {
          review,
          imagesUrl,
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        code: 500,
        message: "Lỗi hệ thống: " + error.message,
      });
    }
  }
};

const getAllReviewsByProduct = async (req, res) => {
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
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm không tồn tại",
      });
    }

    const reviews = await Review.aggregate([
      {
        $match: { productId: new mongoose.Types.ObjectId(productId) },
      },

      // Join với ImageReview
      {
        $lookup: {
          from: "imagereviews",
          localField: "_id",
          foreignField: "reviewId",
          as: "imagesUrl",
        },
      },

      {
        $addFields: {
          imagesUrl: {
            $map: { input: "$imagesUrl", as: "img", in: "$$img.imageUrl" },
          },
        },
      },

      // Join với User để lấy fullName nếu có userId
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
          fullName: {
            $cond: {
              if: { $gt: [{ $size: "$userInfo" }, 0] },
              then: { $arrayElemAt: ["$userInfo.fullName", 0] },
              else: "$fullName", // giữ fullName đã lưu sẵn khi userId = null
            },
          },
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

    const totalReviews = await Review.countDocuments({ productId }); 

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách đánh giá sản phẩm",
      data: reviews,
      pagination: {
        page,
        limit,
        totalReviews,
        totalPages: Math.ceil( totalReviews / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const deleteReview = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const { reviewId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID review không hợp lệ",
    });
  }

  try {
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Bài đánh giá không tồn tại",
      });
    }

    const imagesReview = await ImageReview.find({ reviewId });
    imagesReview.forEach((image) => {
      cloudinary.uploader.destroy(image.imageUrlPublicId);
    });

    // Xóa ảnh review
    await ImageReview.deleteMany({ reviewId });

    // xóa review
    await Review.findByIdAndDelete(reviewId);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa bài đánh giá thành công",
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
  postReview,
  getAllReviewsByProduct,
  deleteReview,
};
