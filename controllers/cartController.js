const mongoose = require("mongoose");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const ProductVariant = require("../models/productVariant");
const Inventory = require("../models/inventory");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const addToCart = async (req, res) => {
  // Lấy mã token nếu user có đăng nhập
  if (req.headers.authorization) {
    const SECRET_KEY = process.env.SECRET_KEY;
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
  }

  const userId = req.user ? req.user.userId : null;
  const sessionId = req.sessionID ? req.sessionID : null;

  // Nhận mã sản phẩm, số lượng
  const { productVariantId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(productVariantId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  try {
    let cart;

    // Nếu user login thì dùng user_id, còn không thì dùng session_id (client gửi session_id trong cookie/localStorage)
    if (userId) {
      cart = await Cart.findOne({ userId });
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId });
    }

    // Ktra có giỏ hàng chưa -> nếu chưa có tạo giỏ hàng
    if (!cart) {
      cart = await Cart.create({
        userId: userId ? userId : null,
        sessionId: userId ? null : sessionId,
        expires_at: userId
          ? null
          : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      });
    }

    // Ktra sản phẩm biến thể
    const productVariant = await ProductVariant.findById(productVariantId);
    if (!productVariant) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Sản phẩm không tồn tại",
      });
    }

    // Ktra sản phẩm này có trong giỏ hàng chưa -> nếu có thì cộng thêm quantity, ngược lại tạo mới
    const cartItem = await CartItem.findOne({
      productVariantId: productVariant._id,
    });

    if (cartItem) {
      cartItem.quantity += 1;
      await cartItem.save();
    } else if (!cartItem) {
      await CartItem.create({
        cartId: cart._id,
        productVariantId: productVariant._id,
        quantity: 1,
      });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Đã thêm sản phẩm vào giỏ hàng",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const deleteToCart = async (req, res) => {
  const cartItemId = req.params.cartItemId;
  if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm trong giỏ hàng không hợp lệ",
    });
  }

  try {
    const cartItem = await CartItem.findById(cartItemId);
    if (!cartItem) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Sản phẩm trong giỏ hàng không tồn tại",
      });
    }

    // xóa item
    await cartItem.deleteOne();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa sản phẩm ra khỏi giỏ hàng thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateQuantityCartItem = async (req, res) => {
  const cartItemId = req.params.cartItemId;
  const { newQuantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID sản phẩm trong giỏ hàng không hợp lệ",
    });
  }

  if (!newQuantity) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Vui lòng nhập thông tin số lượng mới",
    });
  }

  try {
    const cartItem = await CartItem.findById(cartItemId);
    if (!cartItem) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Không tìm thấy sản phẩm trong giỏ hàng",
      });
    }

    // Kiểm tra còn đủ tồn kho hay không
    const productVariantId = cartItem.productVariantId;
    const inventory = await Inventory.findOne({ productVariantId });
    if (!inventory) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Không tìm thấy tồn kho sản phẩm trong giỏ hàng",
      });
    }

    if (newQuantity >= inventory.quantity) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message:
          "Sản phẩm không đủ số lượng tồn kho. Vui lòng giảm số lượng hoặc chọn sản phẩm khác",
      });
    }

    // Cập nhật số lượng mới trong giỏ hàng
    cartItem.quantity = newQuantity;
    await cartItem.save();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật số lượng sản phẩm trong giỏ hàng thành công",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getCart = async (req, res) => {
  try {
    if (req.headers.authorization) {
      const SECRET_KEY = process.env.SECRET_KEY;
      const authHeader = req.headers.authorization;
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
    }

    const userId = req.user ? req.user.userId : null;
    const sessionId = req.sessionID ? req.sessionID : null;

    let cart;
    if (userId) {
      cart = await Cart.findOne({ userId }).select("_id userId");
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId }).select("_id sessionId");
    }

    // Nếu chưa có giỏ hàng tạo mới,
    if (!cart) {
      cart = await Cart.create({
        userId: userId ? userId : null,
        sessionId: userId ? null : sessionId,
        expires_at: userId ? null : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      });
    }

    // Lấy danh sách item trong giỏ hàng
    const cartItems = await CartItem.aggregate([
      {
        $match: { cartId: cart._id },
      },
      {
        $lookup: {
          from: "productvariants",
          localField: "productVariantId",
          foreignField: "_id",
          as: "productVariant",
        },
      },

      {
        $unwind: {
          path: "$productVariant",
          preserveNullAndEmptyArrays: true,
        },
      },

      // lấy ảnh sản phẩm
      {
        $lookup: {
          from: "variantimages",
          let: { variantId: "$productVariantId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productVariantId", "$$variantId"] },
              },
            },

            {
              $sort: { createdAt: 1 },
            },

            {
              $limit: 1,
            },
            {
              $project: {
                imageUrl: 1,
              },
            },
          ],
          as: "variantimage",
        },
      },

      {
        $unwind: {
          path: "$variantimage",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          quantity: 1,
          productVariantId: "$productVariant._id",
          name: "$productVariant.name",
          sellingPrice: "$productVariant.sellingPrice",
          imageUrl: "$variantimage.imageUrl",
        },
      },
    ]);

    return res.status(200).json({
    status: "success",
    code: 200,
    message: "Lấy thông tin giỏ hàng",
    data: {
      cart,
      cartItems,
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

module.exports = {
  addToCart,
  deleteToCart,
  updateQuantityCartItem,
  getCart,
};
