const mongoose = require("mongoose");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const ProductVariant = require("../models/productVariant");
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

    const productVariantPrice = productVariant.sellingPrice;

    // Ktra sản phẩm này có trong giỏ hàng chưa -> nếu có thì cộng thêm quantity, ngược lại tạo mới
    const cartItem = await CartItem.findOne({
      cartId: cart._id,
      productVariantId: productVariant._id,
    });

    if (cartItem) {
      cartItem.quantity += 1;
      await cartItem.save();

      // Cập nhật lại cart cho totalPrice
      cart.totalPrice += productVariantPrice * 1;
      await cart.save();
    } else if (!cartItem) {
      await CartItem.create({
        cartId: cart._id,
        productVariantId: productVariant._id,
        quantity: 1,
      });

      cart.totalItems += 1;
      cart.totalPrice += productVariantPrice * 1;
      await cart.save();
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

    
    const cart = await Cart.findOne({ _id: cartItem.cartId });
    if (!cart) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Giỏ hàng không tồn tại",
      });
    }

    // sau khi xóa thì cập nhật lại tổng tiền
    const cartItems = await CartItem.find({ cartId: cart._id }).populate(
      "productVariantId"
    );

    let totalPrice = 0;
    cartItems.forEach((item) => {
      totalPrice += item.productVariantId.sellingPrice * item.quantity;
    });

    cart.totalItems -= 1;
    cart.totalPrice = totalPrice;
    await cart.save();

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

module.exports = {
  addToCart,
  deleteToCart,
};
