const mongoose = require("mongoose");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const ProductVariant = require("../models/productVariant");
const Inventory = require("../models/inventory");
const VariantImage = require("../models/variantImage");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

const addToCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let userId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      userId = decoded.userId;
    }

    const { sessionId, productVariantId, quantity = 1 } = req.body;

    if (
      !productVariantId ||
      !mongoose.Types.ObjectId.isValid(productVariantId)
    ) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "ID sản phẩm không hợp lệ",
      });
    }

    // === 1. Tìm hoặc tạo giỏ hàng ===
    let cart = null;

    if (userId) {
      cart = await Cart.findOne({ userId }).session(session);
    } else if (sessionId) {
      // Chỉ tìm cart có sessionId KHÁC null và KHÁC rỗng
      cart = await Cart.findOne({
        sessionId: sessionId,
        sessionId: { $ne: null }, // QUAN TRỌNG NHẤT!!!
      }).session(session);
    }

    // === Nếu không tìm thấy → tạo mới ===
    if (!cart) {
      const newSessionId = sessionId ?? crypto.randomUUID();

      cart = await Cart.create(
        [
          {
            userId: userId || null,
            sessionId: userId ? null : newSessionId,
            expires_at: userId
              ? null
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
        { session }
      );

      cart = cart[0];
    }

    // === 2. Kiểm tra sản phẩm & tồn kho ===
    const productVariant = await ProductVariant.findById(productVariantId)
      .select("name sellingPrice isActive")
      .session(session);

    if (!productVariant || !productVariant.isActive) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Sản phẩm không tồn tại hoặc đã ngừng bán",
      });
    }

    const inventory = await Inventory.findOne({ productVariantId })
      .select("quantity reserved")
      .session(session);

    if (!inventory || inventory.quantity - inventory.reserved < quantity) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Chỉ còn ${
          inventory ? inventory.quantity - inventory.reserved : 0
        } sản phẩm`,
      });
    }

    // === 3. Cập nhật giỏ hàng (atomic) ===
    const cartItem = await CartItem.findOneAndUpdate(
      { cartId: cart._id, productVariantId },
      { $inc: { quantity } },
      { upsert: true, new: true, session }
    );

    // === 4. Reserve inventory (nếu cần) ===
    // await Inventory.findOneAndUpdate(
    //   { productVariantId },
    //   { $inc: { reserved: quantity } },
    //   { session }
    // );

    await session.commitTransaction();

    // === 5. Trả về thông tin chi tiết ===
    const image = await VariantImage.findOne({ productVariantId })
      .sort({ createdAt: 1 })
      .select("imageUrl");

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Thêm vào giỏ hàng thành công",
      data: {
        cartId: cart._id,
        sessionId: cart.sessionId,
        addedItem: {
          cartItemId: cartItem._id,
          productVariantId,
          name: productVariant.name,
          sellingPrice: productVariant.sellingPrice,
          imageUrl: image?.imageUrl || null,
          quantity: cartItem.quantity,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi thêm giỏ hàng:", error);
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống",
    });
  } finally {
    session.endSession();
  }
};

const deleteToCart = async (req, res) => {
  const { cartItemId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
    return res
      .status(400)
      .json({ status: "error", code: 400, message: "ID không hợp lệ" });
  }

  try {
    const cartItem = await CartItem.findByIdAndDelete(cartItemId);
    if (!cartItem) {
      return res
        .status(404)
        .json({ status: "error", code: 404, message: "Không tìm thấy" });
    }

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Xóa thành công",
      data: cartItem._id,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: "error", code: 500, message: "Lỗi hệ thống" });
  }
};

const updateQuantityCartItem = async (req, res) => {
  const { cartItemId } = req.params;
  const { quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
    return res
      .status(400)
      .json({ status: "error", code: 400, message: "ID không hợp lệ" });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res
      .status(400)
      .json({ status: "error", code: 400, message: "Số lượng phải ≥ 1" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cartItem = await CartItem.findById(cartItemId).session(session);
    if (!cartItem) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ status: "error", code: 404, message: "Không tìm thấy" });
    }

    const inventory = await Inventory.findOne({
      productVariantId: cartItem.productVariantId,
    }).session(session);

    const available = inventory ? inventory.quantity - inventory.reserved : 0;
    const currentInCart = cartItem.quantity;
    const diff = quantity - currentInCart;

    if (diff > available) {
      await session.abortTransaction();
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Chỉ còn ${available} sản phẩm`,
      });
    }

    cartItem.quantity = quantity;
    await cartItem.save({ session });

    // Cập nhật reserved
    // if (diff !== 0) {
    //   await Inventory.findOneAndUpdate(
    //     { productVariantId: cartItem.productVariantId },
    //     { $inc: { reserved: diff } },
    //     { session }
    //   );
    // }

    await session.commitTransaction();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật số lượng thành công",
      data: { newQuantity: quantity },
    });
  } catch (error) {
    await session.abortTransaction();
    return res
      .status(500)
      .json({ status: "error", code: 500, message: "Lỗi hệ thống" });
  } finally {
    session.endSession();
  }
};

const getCart = async (req, res) => {
  try {
    let userId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = await jwt.verify(token, process.env.SECRET_KEY);
      userId = decoded.userId;
    }

    const sessionId = req.query.sessionId;

    let cart = null;
    if (userId) {
      cart = await Cart.findOne({ userId });
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId, sessionId: { $ne: null }, });
    }

    // === Lazy cleanup cho guest ===
    if (!userId && cart?.expires_at && cart.expires_at < new Date()) {
      await CartItem.deleteMany({ cartId: cart._id });
      await Cart.deleteOne({ _id: cart._id });
      cart = null;
    }

    // === Tạo mới nếu chưa có ===
    if (!cart) {
      cart = await Cart.create({
        userId: userId || null,
        sessionId: userId ? null : sessionId || crypto.randomUUID(),
        expires_at: userId
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    // === Lấy items ===
    const cartItems = await CartItem.aggregate([
      { $match: { cartId: cart._id } },
      {
        $lookup: {
          from: "productvariants",
          localField: "productVariantId",
          foreignField: "_id",
          as: "variant",
        },
      },
      { $unwind: "$variant" },

      // Lấy số lượng tồn kho hiện tại
      {
        $lookup: {
          from: "inventories",
          localField: "productVariantId",
          foreignField: "productVariantId",
          as: "inventory",
        },
      },
      { $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "variantimages",
          localField: "productVariantId",
          foreignField: "productVariantId",
          as: "image",
          pipeline: [{ $sort: { createdAt: 1 } }, { $limit: 1 }],
        },
      },
      { $unwind: { path: "$image", preserveNullAndEmptyArrays: true } },

      // Tính tồn kho khả dụng
      {
        $addFields: {
          availableStock: {
            $cond: {
              if: {
                $and: [
                  { $ifNull: ["$inventory", false] },
                  {
                    $gte: [
                      { $ifNull: ["$inventory.quantity", 0] },
                      { $ifNull: ["$inventory.reversed", 0] },
                    ],
                  },
                ],
              },
              then: {
                $subtract: [
                  { $ifNull: ["$inventory.quantity", 0] },
                  { $ifNull: ["$inventory.reversed", 0] },
                ],
              },
              else: 0,
            },
          },
        },
      },

      {
        $project: {
          _id: 1,
          quantity: 1,
          productId: "$variant.productId",
          productVariantId: "$variant._id",
          name: "$variant.name",
          sellingPrice: "$variant.sellingPrice",
          imageUrl: "$image.imageUrl",
          isActive: "$variant.isActive",
          inventory: "$inventory.quantity",
          availableStock: 1,
        },
      },
    ]);

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.sellingPrice,
      0
    );

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy giỏ hàng thành công",
      data: {
        cartId: cart._id,
        sessionId: cart.sessionId,
        totalItems,
        totalPrice,
        items: cartItems.map((item) => ({
          cartItemId: item._id,
          productId: item.productId,
          productVariantId: item.productVariantId,
          name: item.name,
          sellingPrice: item.sellingPrice,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          isActive: item.isActive,
          length: item.length,
          width: item.width,
          height: item.height,
          weight: item.weight,
          stock: {
            available: item.availableStock,
            // Cảnh báo nếu sắp hết
            isLowStock: item.availableStock <= 5,
            canAddMore: item.availableStock > item.quantity,
          },
        })),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy giỏ hàng:", error);
    return res
      .status(500)
      .json({ status: "error", code: 500, message: "Lỗi hệ thống" });
  }
};

const mergeCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ===== 1. Lấy userId từ token (đã login) =====
    let userId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      userId = decoded.userId;
    }

    if (!userId) {
      return res.status(401).json({
        status: "error",
        code: 401,
        message: "Không xác thực được người dùng",
      });
    }

    // ===== 2. Lấy sessionId từ client (gửi khi login) =====
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(200).json({
        status: "success",
        code: 200,
        message: "Không có giỏ hàng guest để hợp nhất",
        data: { merged: false },
      });
    }

    // ===== 3. Tìm giỏ hàng guest (chỉ userId = null) =====
    const guestCart = await Cart.findOne({
      sessionId,
      userId: null, // quan trọng: chỉ lấy giỏ guest
    }).session(session);

    if (!guestCart) {
      return res.status(200).json({
        status: "success",
        code: 200,
        message: "Không tìm thấy giỏ hàng guest",
        data: { merged: false },
      });
    }

    // ===== 4. Tìm giỏ hàng của user đã login =====
    let userCart = await Cart.findOne({ userId }).session(session);

    let finalCart;
    let mergedItemsCount = 0;

    if (userCart) {
      // === Có giỏ user → chuyển tất cả item từ guest sang user ===
      const guestItems = await CartItem.find({ cartId: guestCart._id }).session(
        session
      );

      for (const item of guestItems) {
        const existingItem = await CartItem.findOne({
          cartId: userCart._id,
          productVariantId: item.productVariantId,
        }).session(session);

        if (existingItem) {
          // Cùng sản phẩm → cộng dồn số lượng
          existingItem.quantity += item.quantity;
          await existingItem.save({ session });
        } else {
          // Chuyển item sang user cart
          await CartItem.create(
            [
              {
                cartId: userCart._id,
                productVariantId: item.productVariantId,
                quantity: item.quantity,
              },
            ],
            { session }
          );
        }
        mergedItemsCount++;
      }

      // Xóa giỏ guest
      await CartItem.deleteMany({ cartId: guestCart._id }).session(session);
      await Cart.deleteOne({ _id: guestCart._id }).session(session);

      finalCart = userCart;
    } else {
      // === Không có giỏ user → gán giỏ guest cho user ===
      await Cart.updateOne(
        { _id: guestCart._id },
        {
          userId,
          sessionId: null,
          expires_at: null,
        }
      ).session(session);

      finalCart = await Cart.findById(guestCart._id).session(session);
    }

    await session.commitTransaction();

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Hợp nhất giỏ hàng thành công",
      data: {
        merged: true,
        cartId: finalCart._id,
        mergedItemsCount,
        totalItems: await CartItem.countDocuments({ cartId: finalCart._id }),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi hợp nhất giỏ hàng:", error);
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống khi hợp nhất giỏ hàng",
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  addToCart,
  deleteToCart,
  updateQuantityCartItem,
  getCart,
  mergeCart,
};
