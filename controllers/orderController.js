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
  calculateGHNShippingFee,
} = require("../services/ghnService");
const OrderShipment = require("../models/orderShipment");
const Role = require("../models/role");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { sendPasswordCreateAccount } = require("../config/mailConfig");
const OrderStatus = require("../constants/orderStatus");
const paymentController = require("../controllers/paymentController");

const createOrder = async (req, res) => {
  // Xử lý transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // ====== 1. Xử lý user (nếu có token) ======
    if (req.headers.authorization) {
      const SECRET_KEY = process.env.SECRET_KEY;
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
    }

    const userId = req.user ? req.user.userId : null;
    const {
      cartId,
      couponCode,
      loyaltyPoints = 0,
      paymentMethod,
      sessionId,
    } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Vui lòng chọn phương thức thanh toán",
      });
    }

    if (!userId && !sessionId) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Thiếu sessionId cho người dùng chưa đăng nhập",
      });
    }

    // ====== 2. Tìm giỏ hàng ======
    const cart = sessionId
      ? await Cart.findOne({ sessionId })
      : await Cart.findById(cartId);

    if (!cart)
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Giỏ hàng không tồn tại",
      });

    // ====== 3. Lấy sản phẩm trong giỏ hàng ======
    const cartItems = await CartItem.find({ cartId: cart._id }).populate({
      path: "productVariantId",
      select: "name sellingPrice weight width height length imageUrl",
    });

    if (!cartItems.length)
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Giỏ hàng hiện chưa có sản phẩm",
      });

    // ====== 4. Kiểm tra tồn kho và tính tổng ======
    let totalPrice = 0;

    for (const item of cartItems) {
      const variant = item.productVariantId;
      if (!variant || typeof variant.sellingPrice !== "number") {
        return res.status(400).json({
          status: "error",
          code: 400,
          message: "Sản phẩm có dữ liệu giá không hợp lệ",
        });
      }

      const inventory = await Inventory.findOne({
        productVariantId: variant._id,
      });
      if (!inventory || inventory.quantity < item.quantity) {
        return res.status(400).json({
          status: "error",
          code: 400,
          message: "Sản phẩm không đủ số lượng tồn kho",
        });
      }

      totalPrice += variant.sellingPrice * item.quantity;
    }

    // ====== 5. Áp dụng mã giảm giá ======
    let coupon = null;
    let discountPrice = 0;

    if (couponCode) {
      coupon = await Coupon.findOne({ couponCode });
      if (!coupon) {
        return res.status(404).json({
          status: "error",
          code: 404,
          message: "Mã giảm giá không hợp lệ",
        });
      }
      discountPrice = Number(coupon.discountPrice) || 0;
      totalPrice -= discountPrice;
    }

    const totalItems = cartItems.length;

    // ====== 6. Xử lý người dùng và địa chỉ ======
    let user, address;
    if (cart.sessionId) {
      // khách chưa đăng nhập
      const {
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

      if (
        !email ||
        !fullName ||
        !phoneNumber ||
        !addressDetail ||
        !wardCode ||
        !ward ||
        !districtCode ||
        !district ||
        !provinceCode ||
        !province
      ) {
        return res.status(400).json({
          status: "error",
          code: 400,
          message: "Vui lòng nhập đầy đủ thông tin giao hàng",
        });
      }

      user = await User.findOne({ email });
      if (!user) {
        const role = await Role.findOne({ roleName: "USER" });

        user = await User.create({
          roleId: role._id,
          email,
          fullName,
          phoneNumber,
          isActive: false,
        });

        address = await Address.create({
          userId: user._id,
          ward,
          wardCode,
          district,
          districtCode,
          province,
          provinceCode,
          addressDetail,
          isDefault: true,
        });

        // Tạo tài khoản mới
      } else {
        address = await Address.findOne({ userId: user._id, isDefault: true });
      }
    } else {
      // người dùng đã đăng nhập
      user = await User.findById(userId);
      if (!user)
        return res.status(404).json({
          status: "error",
          code: 404,
          message: "Người dùng không tồn tại",
        });

      address = await Address.findOne({ userId, isDefault: true });
      if (!address)
        return res.status(404).json({
          status: "error",
          code: 404,
          message: "Vui lòng thêm địa chỉ mặc định",
        });

      // trừ điểm tích lũy
      if (loyaltyPoints > 0) {
        if (loyaltyPoints > user.loyaltyPoints)
          return res.status(400).json({
            status: "error",
            code: 400,
            message: "Số điểm tích lũy vượt quá số điểm hiện có",
          });

        totalPrice -= loyaltyPoints * 1000;
      }
    }

    // ====== 7. Xử lý phương thức thanh toán ======
    if (paymentMethod === PaymentMethod.CASH) {
      const orderCode = "ORD" + Date.now();

      // Gọi API GHN trước để có phí ship
      const ghnData = await createGHNOrder({
        to_name: user.fullName,
        to_phone: user.phoneNumber,
        to_address: `${address.addressDetail}, ${address.ward}, ${address.district}, ${address.province}`,
        to_ward_code: address.wardCode,
        to_district_id: address.districtCode,
        cod_amount: totalPrice,
        items: cartItems.map((item) => ({
          name: item.productVariantId.name,
          code: item.productVariantId._id.toString(),
          quantity: item.quantity,
          price: item.productVariantId.sellingPrice,
          length: item.productVariantId.length,
          width: item.productVariantId.width,
          height: item.productVariantId.height,
          weight: item.productVariantId.weight,
        })),
      });

      if (!ghnData || ghnData.code !== 200) {
        console.log("GHN response:", ghnData);
        throw new Error("Không thể tạo đơn hàng giao hàng nhanh");
      }

      const { total_fee, order_code, expected_delivery_time } = ghnData.data;

      // ====== 8. Tạo Order ======
      const order = await Order.create({
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
        totalQuantity: totalItems,
        loyaltyPoints,
        couponId: coupon ? coupon._id : null,
        couponCode: coupon ? coupon.couponCode : null,
        discountPrice,
        currentStatus: OrderStatus.PENDING,
        paymentStatus: "UNPAID",
        paymentMethod,
        purchaseTime: Date.now(),
        estimatedDelivery: expected_delivery_time,
        shippingFee: total_fee,
        serviceId: 2,
      });

      // ====== 9. Tạo OrderItem và cập nhật tồn kho ======
      for (const item of cartItems) {
        const variant = item.productVariantId;
        await OrderItem.create({
          orderId: order._id,
          productVariantId: variant._id,
          quantity: item.quantity,
          name: variant.name,
          imageUrl: variant.imageUrl,
          price: variant.sellingPrice,
        });

        await Inventory.updateOne(
          { productVariantId: variant._id },
          { $inc: { quantity: -item.quantity } }
        );
      }

      // ====== 10. Tạo OrderShipment ======
      await OrderShipment.create({
        orderId: order._id,
        ghnOrderCode: order_code,
        serviceId: 2,
        fee: total_fee,
        status: "PENDING",
        expectedDeliveryTime: expected_delivery_time,
      });

      // ====== 11. Cập nhật điểm tích lũy & coupon ======
      if (loyaltyPoints > 0) {
        user.loyaltyPoints -= loyaltyPoints;
      }
      user.loyaltyPoints += Math.ceil(order.totalPrice / 1000);
      await user.save();

      if (coupon) {
        coupon.usedCount += 1;
        await coupon.save();
      }

      await OrderHistory.create({
        orderId: order._id,
        status: OrderStatus.PENDING,
      });

      // Xóa giỏ hàng
      await CartItem.deleteMany({ cartId: cart._id });
      await Cart.findOneAndDelete({ _id: cart._id });

      // Gửi email tạo tài khoản -> nếu đây là khách hàng mới
      if (user.isActive === false) {
        const token = jwt.sign(
          {
            email: user.email,
            type: "set_password",
          },
          process.env.SECRET_KEY,
          {
            expiresIn: "2h",
          }
        );
        await sendPasswordCreateAccount(user.email, token, user.fullName);
      }

      // Commit transaction
      await session.commitTransaction();

      // Gửi email về nội dung order đã đặt
      await sendOrderConfirmationEmail(order, user.email, user.fullName);

      return res.status(201).json({
        status: "success",
        code: 201,
        message: "Tạo đơn hàng thành công",
      });
    } else if (paymentMethod === PaymentMethod.VNPAY) {
      const orderCode = "ORD" + Date.now();

      // Tính tổng trọng lượng
      const totalWeight = cartItems.reduce(
        (sum, item) => sum + item.productVariantId.weight * item.quantity,
        0
      );

      // Tính kích thước trung bình (có thể thay bằng lớn nhất nếu GHN yêu cầu)
      const avgHeight =
        cartItems.reduce(
          (sum, item) => sum + item.productVariantId.height * item.quantity,
          0
        ) / cartItems.reduce((sum, item) => sum + item.quantity, 0);

      const avgLength =
        cartItems.reduce(
          (sum, item) => sum + item.productVariantId.length * item.quantity,
          0
        ) / cartItems.reduce((sum, item) => sum + item.quantity, 0);

      const avgWidth =
        cartItems.reduce(
          (sum, item) => sum + item.productVariantId.width * item.quantity,
          0
        ) / cartItems.reduce((sum, item) => sum + item.quantity, 0);

      // Gửi lên GHN để tính phí ship dựa trên địa chỉ
      const ghnData = await calculateGHNShippingFee({
        to_district_id: address.districtCode,
        to_ward_code: address.wardCode,
        height: Math.ceil(avgHeight),
        length: Math.ceil(avgLength),
        width: Math.ceil(avgWidth),
        weight: totalWeight,
        insurance_value: totalPrice,
        items: cartItems.map((item) => ({
          name: item.productVariantId.name,
          quantity: item.quantity,
          height: item.productVariantId.height,
          weight: item.productVariantId.weight,
          length: item.productVariantId.length,
          width: item.productVariantId.width,
        })),
      });

      if (!ghnData || ghnData.code !== 200) {
        throw new Error("Không thể tính phí giao hàng");
      }

      const shippingFee = ghnData.data.total;
      const totalPayment = totalPrice + shippingFee;

      // Tạo session để tránh conflict giữa 2 người dùng đặt cùng lúc
      const session = await mongoose.startSession();
      console.log("Session created:", !!session);
      session.startTransaction();
      console.log(
        "Transaction started:",
        session.transaction.isActive ? "Active" : "Not active"
      );

      // ====== Tạo Order ======
      const order = await Order.create(
        [
          {
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
            totalPrice: totalPrice,
            totalQuantity: totalItems,
            loyaltyPoints,
            couponId: coupon ? coupon._id : null,
            couponCode: coupon ? coupon.couponCode : null,
            discountPrice,
            currentStatus: OrderStatus.PENDING,
            paymentStatus: "Chưa thanh toán",
            paymentMethod,
            purchaseTime: Date.now(),
            serviceId: 2,
          },
        ],
        session
      );

      // ====== 9. Tạo OrderItem và cập nhật tồn kho ======
      for (const item of cartItems) {
        const variant = item.productVariantId;

        // Kiểm tra tồn kho có đủ không
        const inventory = await Inventory.findOne({
          productVariantId: variant._id,
        }).session(session);

        if (
          !inventory ||
          inventory.quantity - inventory.reversed < item.quantity
        ) {
          await session.abortTransaction();
          return res.status(400).json({
            status: "error",
            code: 400,
            message: `Sản phẩm ${variant.name} không đủ số lượng tồn kho`,
          });
        }

        // Giữ hàng tạm thời
        await Inventory.updateOne(
          { productVariantId: variant._id },
          { $inc: { reversed: item.quantity } }
        ).session(session);

        await OrderItem.create(
          [
            {
              orderId: order[0]._id,
              productVariantId: variant._id,
              quantity: item.quantity,
              name: variant.name,
              price: variant.sellingPrice,
            },
          ],
          session
        );
      }

      // Tính điểm tích lũy cho user
      if (loyaltyPoints > 0) {
        user.loyaltyPoints -= loyaltyPoints;
      }
      user.loyaltyPoints += Math.ceil(totalPrice / 1000);
      await user.save({ session });

      // Cập nhật coupon đã sử dụng nếu có sử dụng
      if (coupon) {
        coupon.usedCount += 1;
        await coupon.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      // Tạo URL thanh toán VNPAY
      const paymentUrl = await paymentController.createVnpayPayment(
        orderCode,
        totalPayment,
        req
      );
      if (!paymentUrl) {
        return res.status(500).json({
          status: "error",
          code: 500,
          message: "Lỗi khi tạo URL thanh toán VNPAY",
        });
      }

      return res.status(201).json({
        status: "success",
        code: 201,
        message: "Tạo URL thanh toán VNPAY thành công",
        data: paymentUrl,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  } finally {
    session.endSession();
  }
};

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
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const skip = (page - 1) * limit;

  try {
    const [orders, totalOrders] = await Promise.all([
      await Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      await Order.find().countDocuments(),
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
