const mongoose = require("mongoose");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const ProductVariant = require("../models/productVariant");
const Inventory = require("../models/inventory");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const addToCart = async (req, res) => {
  try {
    // ===== 1. Xác thực người dùng nếu có token =====
    let userId = null;
    if (req.headers.authorization) {
      const SECRET_KEY = process.env.SECRET_KEY;
      const authHeader = req.headers.authorization;
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, SECRET_KEY);
      userId = decoded.userId;
    }

    // ===== 2. Lấy sessionId từ client (gửi qua req.body) =====
    const { sessionId, productVariantId } = req.body;

    if (!productVariantId) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Thiếu ID sản phẩm biến thể",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productVariantId)) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "ID sản phẩm không hợp lệ",
      });
    }

    if (!userId && !sessionId) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Thiếu sessionId cho người dùng chưa đăng nhập",
      });
    }

    // ===== 3. Tìm hoặc tạo giỏ hàng =====
    let cart;

    if (userId) {
      cart = await Cart.findOne({ userId });
    } else {
      cart = await Cart.findOne({ sessionId });
    }

    if (!cart) {
      cart = await Cart.create({
        userId: userId || null,
        sessionId: userId ? null : sessionId,
        expires_at: userId
          ? null
          : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 ngày
      });
    }

    // ===== 4. Kiểm tra sản phẩm biến thể có tồn tại không =====
    const productVariant = await ProductVariant.findById(productVariantId);
    if (!productVariant) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Sản phẩm không tồn tại",
      });
    }

    // ===== 5. Kiểm tra sản phẩm đã có trong giỏ chưa =====
    let cartItem = await CartItem.findOne({
      cartId: cart._id,
      productVariantId: productVariant._id,
    });

    if (cartItem) {
      cartItem.quantity += 1;
      await cartItem.save();
    } else {
      await CartItem.create({
        cartId: cart._id,
        productVariantId: productVariant._id,
        quantity: 1,
      });
    }

    // ===== 6. Trả về kết quả =====
    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Đã thêm sản phẩm vào giỏ hàng",
      data: {
        cartId: cart._id,
        sessionId: cart.sessionId,
      },
    });
  } catch (error) {
    console.error("Lỗi thêm giỏ hàng:", error);
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
    // ===== 1. Giải mã token nếu người dùng đăng nhập =====
    let userId = null;
    if (req.headers.authorization) {
      const SECRET_KEY = process.env.SECRET_KEY;
      const authHeader = req.headers.authorization;
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, SECRET_KEY);
      userId = decoded.userId;
    }

    // ===== 2. Lấy sessionId từ client =====
    // FE có thể gửi qua body, params hoặc query, ở đây mình linh hoạt hỗ trợ cả 2
    const sessionId = req.query.sessionId || null;

    // if (!userId && !sessionId) {
    //   return res.status(400).json({
    //     status: "error",
    //     code: 400,
    //     message: "Thiếu sessionId cho người dùng chưa đăng nhập",
    //   });
    // }

    // ===== 3. Tìm giỏ hàng =====
    let cart;
    if (userId) {
      cart = await Cart.findOne({ userId }).select("_id userId");
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId }).select("_id sessionId");
    }

    // ===== 4. Nếu chưa có giỏ hàng → tạo mới =====
    if (!cart) {
      cart = await Cart.create({
        userId: userId || null,
        sessionId: userId ? null : sessionId,
        expires_at: userId
          ? null
          : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 ngày
      });
    }

    // ===== 5. Lấy danh sách sản phẩm trong giỏ hàng =====
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
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
            { $project: { imageUrl: 1 } },
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

    // ===== 6. Trả về kết quả =====
    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy thông tin giỏ hàng thành công",
      data: {
        cart,
        cartItems,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy giỏ hàng:", error);
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
