const Order = require("../models/order");
const OrderItem = require("../models/orderItem");
const OrderHistory = require("../models/orderHistory");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const Inventory = require("../models/inventory");
const Coupon = require("../models/coupon");
const User = require("../models/user");
const PaymentMethod = require("../constants/paymentMethod");
const Address = require("../models/address");
const {
  createGHNOrder,
  calculateGHNShippingFeeV2,
} = require("../services/ghnService");
const OrderShipment = require("../models/orderShipment");
const Role = require("../models/role");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const {
  sendPasswordCreateAccount,
  sendOrderConfirmationEmail,
  sendAccountPasswordAfterOrder,
} = require("../config/mailConfig");
const OrderStatus = require("../constants/orderStatus");
const paymentController = require("../controllers/paymentController");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ====== 1. Xác thực user (nếu có token) ======
    let userId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      userId = decoded.userId;
    }

    const {
      cartId,
      sessionId,
      couponCode,
      loyaltyPoints = 0,
      paymentMethod,
      // Chỉ dành cho guest
      email,
      fullName,
      phoneNumber,
      wardCode,
      ward,
      districtCode,
      district,
      provinceCode,
      province,
      addressDetail,
    } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        status: "error",
        message: "Vui lòng chọn phương thức thanh toán",
      });
      return;
    }

    if (!userId && !sessionId) {
      return res.status(400).json({
        status: "error",
        message: "Thiếu sessionId cho khách vãng lai",
      });
    }

    // ====== 2. Tìm giỏ hàng ======
    const cart = sessionId
      ? await Cart.findOne({ sessionId }).session(session)
      : await Cart.findById(cartId).session(session);

    if (!cart)
      return res
        .status(404)
        .json({ status: "error", message: "Giỏ hàng không tồn tại" });

    // ====== 3. Lấy sản phẩm trong giỏ hàng + ảnh từ Product (defaultImage) ======
    const cartItems = await CartItem.find({ cartId: cart._id })
      .populate({
        path: "productVariantId",
        select: "name sellingPrice weight width height length productId", // thêm productId
        populate: {
          path: "productId",
          select: "defaultImage", // chỉ lấy ảnh đại diện của sản phẩm
        },
      })
      .session(session)
      .lean();

    if (cartItems.length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Giỏ hàng trống" });
    }

    let totalPrice = 0;
    const items = [];
    for (const item of cartItems) {
      const v = item.productVariantId;
      if (!v || typeof v.sellingPrice !== "number") {
        return res
          .status(400)
          .json({ status: "error", message: "Dữ liệu sản phẩm lỗi" });
      }
      totalPrice += v.sellingPrice * item.quantity;

      items.push({
        name: v.name || "Sản phẩm",
        quantity: item.quantity,
        weight: v.weight,
        length: v.length || 20,
        width: v.width || 15,
        height: v.height || 10,
      });
    }

    // ====== 4. Áp dụng coupon ======
    let coupon = null;
    let discountPrice = 0;
    if (couponCode) {
      coupon = await Coupon.findOne({ couponCode }).session(session);
      if (!coupon)
        return res
          .status(404)
          .json({ status: "error", message: "Mã giảm giá không tồn tại" });
      discountPrice = Number(coupon.discountPrice) || 0;
      totalPrice -= discountPrice;
    }

    // ====== 5. Trừ số tiền tương đương điểm tích lũy nếu có ======
    if (loyaltyPoints > 0) {
      totalPrice -= loyaltyPoints * 1000;
    }

    // ==================================================================
    // ================== THANH TOÁN COD =============================
    // ==================================================================
    if (paymentMethod === PaymentMethod.CASH) {
      const orderCode = "ORD" + Date.now();

      // BƯỚC 1: GIỮ HÀNG TRƯỚC KHI GỌI GHN (QUAN TRỌNG NHẤT
      for (const item of cartItems) {
        const variantId = item.productVariantId._id;

        const inventory = await Inventory.findOne({
          productVariantId: variantId,
        }).session(session);
        if (!inventory) throw new Error("Sản phẩm không tồn tại trong kho");

        const available = inventory.quantity - inventory.reversed;
        if (available < item.quantity) {
          throw new Error(
            `${item.productVariantId.name} chỉ còn ${available} sản phẩm`
          );
        }

        const updated = await Inventory.findOneAndUpdate(
          {
            productVariantId: variantId,
            quantity: { $gte: available },
            reversed: inventory.reversed,
          },
          { $inc: { reversed: item.quantity } },
          { session, new: true }
        );

        if (!updated)
          throw new Error(
            `${item.productVariantId.name} vừa được đặt bởi khách khác`
          );
      }

      // ====== 5. Xử lý user & địa chỉ ======
      let user, address;
      let password;
      if (sessionId) {
        // Khách vãng lai
        if (
          !email ||
          !fullName ||
          !phoneNumber ||
          !addressDetail ||
          !wardCode ||
          !districtCode ||
          !provinceCode
        ) {
          for (const item of cartItems) {
            await Inventory.updateOne(
              { productVariantId: item.productVariantId._id },
              { $inc: { reversed: -item.quantity } },
              { session }
            );
          }

          return res.status(400).json({
            status: "error",
            message: "Vui lòng nhập đầy đủ thông tin giao hàng",
          });
        }

        user = await User.findOne({ email }).session(session);

        if (!user) {
          const role = await Role.findOne({ roleName: "USER" }).session(
            session
          );
          password = generateRandomPassword(10);
          const hashed = await bcrypt.hash(password, 10);

          user = await User.create(
            [
              {
                roleId: role._id,
                email,
                fullName,
                phoneNumber,
                password: hashed,
                isActive: false,
              },
            ],
            { session }
          )[0];

          address = await Address.create(
            [
              {
                userId: user._id,
                ward,
                wardCode,
                district,
                districtCode,
                province,
                provinceCode,
                addressDetail,
                isDefault: true,
              },
            ],
            { session }
          )[0];
        } else {
          address = {
            userId: user._id,
            ward,
            wardCode,
            district,
            districtCode,
            province,
            provinceCode,
            addressDetail,
          };
        }
      } else {
        // Đã đăng nhập
        user = await User.findById(userId).session(session);
        if (!user)
          return res
            .status(404)
            .json({ status: "error", message: "User không tồn tại" });

        address = await Address.findOne({
          userId: userId,
          isDefault: true,
        }).session(session);
        if (!address)
          return res
            .status(400)
            .json({ status: "error", message: "Chưa có địa chỉ mặc định" });

        if (loyaltyPoints > 0) {
          if (loyaltyPoints > user.loyaltyPoints) {
            return res
              .status(400)
              .json({ status: "error", message: "Điểm tích lũy không đủ" });
          }
          totalPrice -= loyaltyPoints * 1000;
        }
      }

      // BƯỚC 2: GỌI GHN TẠO ĐƠN
      let ghnData;
      try {
        ghnData = await createGHNOrder({
          to_name: user.fullName || fullName,
          to_phone: user.phoneNumber || phoneNumber,
          to_address: `${address.addressDetail}, ${address.ward}, ${address.district}, ${address.province}`,
          to_province: address.province,
          to_district: address.district,
          to_ward: address.ward,
          cod_amount: Math.round(totalPrice), // GHN yêu cầu nguyên
          weight: cartItems.reduce(
            (s, i) => s + (i.productVariantId.weight || 200) * i.quantity,
            0
          ),
          items: cartItems.map((i) => ({
            name: i.productVariantId.name,
            code: i.productVariantId._id.toString(),
            quantity: i.quantity,
            price: i.productVariantId.sellingPrice,
            weight: i.productVariantId.weight || 200,
            length: i.productVariantId.length || 10,
            width: i.productVariantId.width || 10,
            height: i.productVariantId.height || 10,
          })),
        });

        if (!ghnData || ghnData.code !== 200)
          throw new Error("GHN từ chối tạo đơn");
      } catch (err) {
        // TRẢ LẠI HÀNG ĐÃ GIỮ
        for (const item of cartItems) {
          await Inventory.updateOne(
            { productVariantId: item.productVariantId._id },
            { $inc: { reversed: -item.quantity } },
            { session }
          );
        }
        throw err;
      }

      const { total_fee, order_code, expected_delivery_time } = ghnData.data;

      // BƯỚC 3: TẠO ĐƠN HÀNG
      const order = new Order({
        orderCode,
        userId: user._id,
        phoneNumber: user.phoneNumber,
        wardCode: address.wardCode,
        ward: address.ward,
        districtCode: address.districtCode,
        district: address.district,
        provinceCode: address.provinceCode,
        province: address.province,
        addressDetail: address.addressDetail,
        totalPrice: totalPrice + total_fee,
        totalQuantity: cartItems.length,
        loyaltyPoints,
        couponId: coupon?._id,
        couponCode: coupon?.couponCode,
        discountPrice,
        currentStatus: OrderStatus.PENDING,
        paymentStatus: "UNPAID",
        paymentMethod,
        purchaseTime: Date.now(),
        estimatedDelivery: expected_delivery_time,
        shippingFee: total_fee,
        serviceId: 2,
        ghnOrderCode: order_code,
      });

      await order.save({ session });

      // Tạo OrderItem
      await OrderItem.insertMany(
        cartItems.map((item) => {
          const variant = item.productVariantId;

          return {
            orderId: order._id,
            productVariantId: variant._id,
            quantity: item.quantity,
            name: variant.name || "Sản phẩm không xác định",
            price: variant.sellingPrice || 0,
          };
        }),
        { session }
      );

      await OrderShipment.create(
        [
          {
            orderId: order._id,
            ghnOrderCode: order_code,
            serviceId: 2,
            fee: total_fee,
            status: "PENDING",
            expectedDeliveryTime: expected_delivery_time,
          },
        ],
        { session }
      );

      // Cập nhật điểm + coupon
      user.loyaltyPoints =
        user.loyaltyPoints -
        loyaltyPoints +
        Math.ceil((totalPrice + total_fee) / 1000);
      await user.save({ session });

      if (coupon) {
        coupon.usedCount += 1;
        await coupon.save({ session });
      }

      await OrderHistory.create(
        [{ orderId: order._id, status: OrderStatus.PENDING }],
        { session }
      );

      await session.commitTransaction();
      // await session.end();

      // Xóa giỏ
      await CartItem.deleteMany({ cartId: cart._id }, { session });
      await Cart.deleteOne({ _id: cart._id }, { session });

      // Gửi email xác nhận
      await sendOrderConfirmationEmail(order, user.email, user.fullName);

      if (password) {
        await sendAccountPasswordAfterOrder(user.email, password, user.fullName, order.orderCode);
      }

      return res.status(201).json({
        status: "success",
        message: "Đặt hàng COD thành công!",
        data: { orderCode, ghnOrderCode: order_code },
      });
    }

    // ==================================================================
    // ================== THANH TOÁN VNPAY ==============================
    // ==================================================================

    if (paymentMethod === PaymentMethod.VNPAY) {
      const orderCode = "ORD" + Date.now();

      // ================== BƯỚC 1: GIỮ HÀNG TRƯỚC TIÊN (QUAN TRỌNG NHẤT) ==================
      try {
        for (const item of cartItems) {
          const variantId = item.productVariantId._id;

          const inventory = await Inventory.findOne({
            productVariantId: variantId,
          }).session(session);

          if (!inventory) throw new Error("Sản phẩm không tồn tại");

          const available = inventory.quantity - inventory.reversed;
          if (available < item.quantity) {
            throw new Error(
              `${item.productVariantId.name} chỉ còn ${available} sản phẩm`
            );
          }

          const updated = await Inventory.findOneAndUpdate(
            {
              productVariantId: variantId,
              quantity: inventory.quantity,
              reversed: inventory.reversed,
            },
            { $inc: { reversed: item.quantity } },
            { session, new: true }
          );

          if (!updated)
            throw new Error(
              `${item.productVariantId.name} vừa được đặt bởi khách khác`
            );
        }
      } catch (err) {
        throw err;
      }

      let user;
      let address;
      let isGuestAccount = false;
      let guestPassword;
      if (userId) {
        // Trường hợp có đăng nhập
        user = await User.findById(userId).session(session);
        if (!user) {
          return res.status(404).json({
            status: "error",
            code: 404,
            message: "Người dùng không tồn tại",
          });
        }

        address = await Address.findOne({
          userId: user._id,
          isDefault: true,
        }).session(session);
        if (!address) {
          return res.status(400).json({
            status: "error",
            code: 400,
            message: "Chưa có địa chỉ mặc định",
          });
        }
      } else {
        // ================== GUEST CHECKOUT - GIỐNG HỆT COD ==================
        let existingUser = await User.findOne({ email }).session(session);

        if (!existingUser) {
          // Email chưa từng tồn tại → tạo mới hoàn toàn
          const role = await Role.findOne({ roleName: "USER" }).session(
            session
          );
          const password = generateRandomPassword(10);
          const hashed = await bcrypt.hash(password, 10);

          const newUser = await User.create(
            [
              {
                roleId: role._id,
                email,
                fullName,
                phoneNumber: phoneNumber || null,
                password: hashed,
                isActive: true,
              },
            ],
            { session }
          );

          user = newUser[0];
          guestPassword = password;
          isGuestAccount = true;

          // Tạo địa chỉ mới từ thông tin khách nhập
          const newAddr = await Address.create(
            [
              {
                userId: user._id,
                ward,
                wardCode,
                district,
                districtCode,
                province,
                provinceCode,
                addressDetail,
                isDefault: true, // vẫn để mặc định cho lần đầu
              },
            ],
            { session }
          );

          address = newAddr[0];
        } else {
          // Email ĐÃ TỒN TẠI → dùng lại user này
          user = existingUser;
          isGuestAccount = false;
          guestPassword = null;

          address = {
            userId: user._id,
            ward,
            wardCode,
            district,
            districtCode,
            province,
            provinceCode,
            addressDetail,
          };
        }
      }

      // ================== BƯỚC 2: TÍNH PHÍ SHIP ==================
      let shippingFee = 0;
      let expectedDeliveryTime = null;
      let order_code = null;

      try {
        const totalWeight = cartItems.reduce(
          (s, i) => s + (i.productVariantId.weight || 200) * i.quantity,
          0
        );

        const avgDim = (key) =>
          Math.max(
            10,
            Math.ceil(
              cartItems.reduce(
                (s, i) => s + (i.productVariantId[key] || 10) * i.quantity,
                0
              ) / cartItems.reduce((s, i) => s + i.quantity, 0)
            )
          );

        console.log(address);
        const ghnFeeData = await calculateGHNShippingFeeV2(
          totalWeight,
          avgDim("width"),
          avgDim("length"),
          avgDim("height"),
          address,
          items
        );

        if (!ghnFeeData || ghnFeeData.code !== 200)
          throw new Error("Không tính được phí ship");

        shippingFee = ghnFeeData.data.total;
        expectedDeliveryTime = ghnFeeData.data.leadtime || null;
        order_code = ghnFeeData.data.order_code;
      } catch (err) {
        // Lỗi tính phí → trả hàng
        for (const item of cartItems) {
          await Inventory.updateOne(
            { productVariantId: item.productVariantId._id },
            { $inc: { reversed: -item.quantity } },
            { session }
          );
        }
        throw err;
      }

      const totalPayment = totalPrice + shippingFee;

      // ================== BƯỚC 3: TẠO ĐƠN HÀNG TẠM (CHỈ LƯU THÔNG TIN, CHƯA HOÀN TẤT) ==================

      const order = new Order({
        orderCode,
        userId: user._id,
        cartSessionId: sessionId ? sessionId : null,
        phoneNumber: user.phoneNumber,
        wardCode: address.wardCode,
        ward: address.ward,
        districtCode: address.districtCode,
        district: address.district,
        provinceCode: address.provinceCode,
        province: address.province,
        addressDetail: address.addressDetail,
        totalPrice: totalPayment,
        totalQuantity: cartItems.length,
        loyaltyPoints,
        couponId: coupon?._id,
        couponCode: coupon?.couponCode,
        discountPrice,
        currentStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: "Chưa thanh toán",
        paymentMethod: "VNPAY",
        purchaseTime: Date.now(),
        estimatedDelivery: expectedDeliveryTime,
        shippingFee,
        serviceId: 2,
        ghnOrderCode: order_code,
        isGuestAccount,
        guestPassword,
      });

      await order.save({ session }); // ← CHÍNH XÁC

      // ====== Lưu OrderItem – giờ đã có ảnh chính xác, không cần query thêm ======
      await OrderItem.insertMany(
        cartItems.map((item) => {
          const variant = item.productVariantId;

          return {
            orderId: order._id,
            productVariantId: variant._id,
            quantity: item.quantity,
            name: variant.name || "Sản phẩm không xác định",
            price: variant.sellingPrice || 0,
          };
        }),
        { session }
      );
      // KHÔNG TRỪ ĐIỂM, KHÔNG XÓA GIỎ, KHÔNG GỬI EMAIL

      // Commit xong, dữ liệu order đã được cập nhật trong DB
      await session.commitTransaction();

      console.log(order);

      // ================== BƯỚC 4: TẠO URL VNPAY ==================
      const paymentUrl = await paymentController.createVnpayPayment(
        orderCode,
        totalPayment,
        req
      );

      if (!paymentUrl) {
        // Lỗi tạo URL → hủy đơn + trả hàng
        await Order.findByIdAndDelete(order._id);
        for (const item of cartItems) {
          await Inventory.updateOne(
            { productVariantId: item.productVariantId._id },
            { $inc: { reversed: -item.quantity } }
          );
        }

        await OrderItem.deleteMany({ orderId: order._id });
        // await OrderHistory.deleteMany({ orderId: order._id });
        return res
          .status(500)
          .json({ status: "error", message: "Lỗi tạo thanh toán VNPAY" });
      }

      return res.status(200).json({
        status: "success",
        message: "Chuyển sang cổng thanh toán...",
        data: {
          orderCode,
          paymentUrl,
          totalPayment,
        },
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("Lỗi đặt hàng:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Hệ thống bận, vui lòng thử lại",
    });
  } finally {
    session.endSession();
  }
};

function generateRandomPassword(length = 10) {
  // Sinh chuỗi ngẫu nhiên rồi mã hóa base64 → cắt gọn
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "") // loại ký tự đặc biệt để tránh lỗi khi gửi mail
    .slice(0, length);
}

const getUserOrders = async (req, res) => {
  const userId = req.user.userId;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID người dùng không hợp lệ",
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Lấy danh sách đơn hàng của người dùng
  try {
    const [orders, totalOrders] = await Promise.all([
      await Order.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      await Order.find({ userId }).countDocuments(),
    ]);

    const totalPages = Math.ceil(totalOrders / limit);
    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách đơn hàng thành công",
      data: orders,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
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

const getOrderItems = async (req, res) => {
  const orderId = req.params.orderId;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID người dùng không hợp lệ",
    });
  }

  try {
    const orderItems = await OrderItem.aggregate([
      {
        $match: { orderId: new mongoose.Types.ObjectId(orderId) },
      },
      {
        $lookup: {
          from: "productvariants",
          localField: "productVariantId",
          foreignField: "_id",
          as: "productvariants",
        },
      },
      {
        $unwind: "$productvariants",
      },
      {
        $lookup: {
          from: "variantimages",
          let: { variantId: "$productvariants._id" },
          pipeline: [
            {
              $match: { $expr: { $eq: ["$productVariantId", "$$variantId"] } },
            },
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
          ],
          as: "image",
        },
      },
      {
        $unwind: {
          path: "$image",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          productVariantId: 1,
          name: 1,
          price: 1,
          "image.imageUrl": 1,
          quantity: 1,
          orderId: 1,
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách sản phẩm trong đơn hàng",
      data: orderItems,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const getStatusOrders = async (req, res) => {
  const orderId = req.params.orderId;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID người dùng không hợp lệ",
    });
  }

  try {
    const orderHistories = await OrderHistory.find({ orderId })
      .sort({
        createdAt: -1,
      })
      .select("_id orderId status createdAt");

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy danh sách trạng thái của đơn hàng thành công",
      data: orderHistories,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

/** ADMIN **/

const getOrdersByAdmin = async (req, res) => {
  try {
    // 1. Kiểm tra quyền ADMIN
    if (req.user.roleName !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        code: 403,
        message: "Không có quyền truy cập tài nguyên này",
      });
    }

    // 2. Phân trang
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    // 3. Các filter từ query
    const { search, status, startDate, endDate, period } = req.query;

    const match = {};

    // Tìm kiếm mã đơn hàng
    if (search?.trim()) {
      match.orderCode = { $regex: search.trim(), $options: "i" };
    }

    // Lọc trạng thái
    if (status && status !== "all" && status !== "") {
      match.currentStatus = status;
    }

    // XỬ LÝ LỌC NHANH THEO PERIOD (rất quan trọng cho UI đẹp của bạn)
    if (period) {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      if (!match.purchaseTime) match.purchaseTime = {};

      switch (period) {
        case "today":
          match.purchaseTime.$gte = startOfDay;
          match.purchaseTime.$lte = endOfDay;
          break;
        case "yesterday":
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const startYesterday = new Date(yesterday);
          startYesterday.setHours(0, 0, 0, 0);
          const endYesterday = new Date(yesterday);
          endYesterday.setHours(23, 59, 59, 999);
          match.purchaseTime.$gte = startYesterday;
          match.purchaseTime.$lte = endYesterday;
          break;
        case "thisWeek":
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Thứ 2
          startOfWeek.setHours(0, 0, 0, 0);
          match.purchaseTime.$gte = startOfWeek;
          break;
        case "thisMonth":
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          match.purchaseTime.$gte = startOfMonth;
          break;
      }
    }

    // Lọc theo ngày tùy chỉnh (ưu tiên hơn period)
    if (startDate || endDate) {
      match.purchaseTime = {};
      if (startDate) {
        match.purchaseTime.$gte = new Date(startDate);
        match.purchaseTime.$gte.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.purchaseTime.$lte = end;
      }
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: match },

      // Join user để lấy fullName + phone
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // Sắp xếp mới nhất trước
      { $sort: { purchaseTime: -1 } },

      // Phân trang
      { $skip: skip },
      { $limit: limit },

      // Project để trả dữ liệu sạch, đúng như FE đang dùng
      {
        $project: {
          _id: 1,
          orderCode: 1,
          totalPrice: 1,
          currentStatus: 1,
          paymentMethod: 1,
          purchaseTime: 1,
          shippingFee: 1,
          discountPrice: 1,
          couponCode: 1,
          loyaltyPoints: 1,
          addressDetail: 1,
          ward: 1,
          district: 1,
          province: 1,
          estimatedDelivery: 1,
          fullName: { $ifNull: ["$user.fullName", "Khách lẻ"] },
          phoneNumber: { $ifNull: ["$user.phoneNumber", "Không có"] },
          email: "$user.email",
        },
      },
    ];

    const orders = await Order.aggregate(pipeline);

    // Đếm tổng (riêng để chính xác)
    const countPipeline = [{ $match: match }, { $count: "total" }];
    const countResult = await Order.aggregate(countPipeline);
    const totalRecords = countResult[0]?.total || 0;

    return res.json({
      status: "success",
      code: 200,
      data: orders,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error) {
    console.error("Admin get orders error:", error);
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

const updateStatusOrder = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const orderId = req.params.orderId;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "ID đơn hàng khhoong hợp lệ",
    });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Đơn hàng không tồn tại",
      });
    }

    // Trạng thái: Đang chờ (PENDING)
    if (order.currentStatus === OrderStatus.PENDING) {
      await OrderHistory.create({
        orderId,
        status: OrderStatus.COMFIRMED,
      });

      order.currentStatus = OrderStatus.COMFIRMED;
      await order.save();
    } else if (order.currentStatus === OrderStatus.COMFIRMED) {
      await OrderHistory.create({
        orderId,
        status: OrderStatus.SHIPPING,
      });

      order.currentStatus = OrderStatus.SHIPPING;
      await order.save();
    } else if (order.currentStatus === OrderStatus.SHIPPING) {
      await OrderHistory.create({
        orderId,
        status: OrderStatus.DELIVERIED,
      });

      order.currentStatus = OrderStatus.DELIVERIED;
      order.paymentStatus = "Đã thanh toán";
      await order.save();

      // Cập nhật lại reversed tồn kho
      const orderItems = await OrderItem.find({ orderId: order._id }).select(
        "_id productVariantId quantity"
      );

      for (const item of orderItems) {
        await Inventory.findOneAndUpdate(
          { productVariantId: item.productVariantId },
          {
            $inc: { reversed: -item.quantity, quantity: -item.quantity },
          }
        );
      }
    } else {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Trạng thái đơn hàng không thể cập nhật",
      });
    }

    // Trả về mã thành công sau khi cập nhật trạng thái đơn hàng
    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Cập nhật trạng thái đơn hàng thành công",
      data: {
        orderId: order._id,
        currentStatus: order.currentStatus,
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
  createOrder,
  getUserOrders,
  getOrderItems,
  getStatusOrders,
  getOrdersByAdmin,
  updateStatusOrder,
};
