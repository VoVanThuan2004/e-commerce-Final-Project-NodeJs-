const {
  vnp_TmnCode,
  vnp_HashSecret,
  vnp_Url,
  vnp_ReturnUrl,
} = require("../config/vnpay");
const moment = require("moment");
require("dotenv").config();
const Order = require("../models/order");
const OrderItem = require("../models/orderItem");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const User = require("../models/user");
const Address = require("../models/address");
const Inventory = require("../models/inventory");
const Coupon = require("../models/coupon");
const OrderShipment = require("../models/orderShipment");
const OrderHistory = require("../models/orderHistory");
const OrderStatus = require("../constants/orderStatus");
const jwt = require("jsonwebtoken");
const { createGHNOrder } = require("../services/ghnService");
const {
  sendOrderConfirmationEmail,
  sendAccountPasswordAfterOrder,
} = require("../config/mailConfig");

const createVnpayPayment = async (orderCode, amount, req) => {
  if (!vnp_TmnCode || !vnp_HashSecret || !vnp_ReturnUrl) {
    return "Vui lòng cấu hình VNPAY trước khi tạo yêu cầu thanh toán.";
  }

  try {
    process.env.TZ = "Asia/Ho_Chi_Minh"; // Thiết lập múi giờ
    const orderInfo = `Thanh toán đơn hàng ${orderCode}`;

    let date = new Date();
    let createDate = moment(date).format("YYYYMMDDHHmmss");

    let ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    let tmnCode = vnp_TmnCode;
    let secretKey = vnp_HashSecret;
    let vnpUrl = vnp_Url;
    let returnUrl = vnp_ReturnUrl;

    let currCode = "VND";
    let vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = "vn";
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = orderCode;
    vnp_Params["vnp_OrderInfo"] = orderInfo;
    vnp_Params["vnp_OrderType"] = "other";
    vnp_Params["vnp_Amount"] = amount * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;

    vnp_Params = sortObject(vnp_Params);

    let querystring = require("qs");
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let crypto = require("crypto");
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;
    vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });

    return vnpUrl;
  } catch (error) {
    return "Lỗi khi tạo yêu cầu thanh toán: " + error.message;
  }
};

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

const vnpayReturn = async (req, res) => {
  // Lấy các query params do VNPAY gửi về
  console.log("VNPAY return query:", req.query);

  let vnp_Params = { ...req.query }; // đảm bảo là plain object

  let secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  let tmnCode = vnp_TmnCode;
  let secretKey = vnp_HashSecret;

  let querystring = require("qs");
  let signData = querystring.stringify(vnp_Params, { encode: false });
  let crypto = require("crypto");
  let hmac = crypto.createHmac("sha512", secretKey);
  let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    // Thanh toán thành công
    if (vnp_Params["vnp_ResponseCode"] === "00") {
      // 1. Lấy mã orderId từ vnp_Params
      const orderCode = vnp_Params["vnp_TxnRef"];
      try {
        // Lấy thông tin order
        const order = await Order.findOne({ orderCode });

        // Lấy thông tin giỏ hàng
        let cart;
        if (order.cartSessionId) {
          cart = await Cart.findOne({ sessionId: order.cartSessionId });
        } else {
          cart = await Cart.findOne({ userId: order.userId });
        }
        const cartItems = await CartItem.find({ cartId: cart._id }).populate(
          "productVariantId"
        );

        const user = await User.findById(order.userId);

        // Nếu một trong các thông tin không hợp lệ thì trả về lỗi, xóa order đã tạo, cập nhật lại reversed stock
        if (!order || !cart || cartItems.length === 0 || !user) {
          // Xóa order đã tạo
          await Order.deleteOne({ orderCode });
          // Cập nhật lại reversed stock
          for (const item of cartItems) {
            const variant = item.productVariantId;

            await Inventory.findOneAndUpdate(
              { productVariantId: variant._id },
              { $inc: { reversed: -item.quantity } }
            );
          }

          await Order.deleteOne({ _id: order._id });
          await OrderItem.deleteMany({ orderId: order._id });

          // Cập nhật lại điểm tích lũy đã cộng
          user.loyaltyPoints += Math.ceil(order.totalPrice / 1000);
          user.isActive = true;
          await user.save();

          // Nếu có sử dụng mã giảm giá, cộng đi số lượng đã dùng
          if (order.couponId) {
            const coupon = await Coupon.findById(order.couponId);
            if (coupon) {
              coupon.usedCount += 1;
              await coupon.save();
            }
          }

          return res.status(400).json({
            status: "error",
            code: 400,
            message: "Dữ liệu không hợp lệ, vui lòng đặt hàng lại",
          });
        }

        // Gọi API GHN trước để có phí ship
        ghnData = await createGHNOrder({
          to_name: user.fullName || fullName,
          to_phone: user.phoneNumber || phoneNumber,
          to_address: `${order.addressDetail}, ${order.ward}, ${order.district}, ${order.province}`,
          to_province: order.province,
          to_district: order.district,
          to_ward: order.ward,
          cod_amount: Math.round(order.totalPrice), // GHN yêu cầu nguyên
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

        if (!ghnData || ghnData.code !== 200) {
          console.log("GHN response:", ghnData);
          throw new Error("Không thể tạo đơn hàng giao hàng nhanh");
        }

        const { total_fee, order_code, expected_delivery_time } = ghnData.data;

        order.currentStatus = "Đang chờ xử lý";
        order.ghnOrderCode = order_code;
        order.vnpTransactionNo = vnp_Params["vnp_TransactionNo"];
        order.vnpBankTranNo = vnp_Params["vnp_BankTranNo"];
        order.estimatedDelivery = expected_delivery_time;
        order.paymentStatus = "Đã thanh toán";
        await order.save();

        // Cập nhật tồn kho (trừ đi stock và reversed)
        for (const item of cartItems) {
          const variant = item.productVariantId;

          await Inventory.findOneAndUpdate(
            { productVariantId: variant._id },
            { $inc: { quantity: -item.quantity, reversed: -item.quantity } }
          );
        }

        // Cập nhật điểm tích lũy cho user
        user.loyaltyPoints += Math.ceil(order.totalPrice / 1000);
        await user.save();

        // Cập nhật trạng thái đơn hàng
        await OrderShipment.create({
          orderId: order._id,
          ghnOrderCode: order_code,
          serviceId: 2,
          fee: total_fee,
          status: OrderStatus.PENDING,
          expectedDeliveryTime: expected_delivery_time,
        });

        await OrderHistory.create({
          orderId: order._id,
          status: OrderStatus.PENDING,
        });

        // Gửi email xác nhận đơn hàng
        await sendOrderConfirmationEmail(order, user.email, user.fullName);

        // Nếu đây là khách hàng mới mua hàng (không login) -> gửi email
        if (order.isGuestAccount === true) {
          await sendAccountPasswordAfterOrder(user.email, order.guestPassword, user.fullName, order.orderCode);
          order.guestPassword = null;
          await order.save();
        }

        // Xóa giỏ hàng
        await CartItem.deleteMany({ cartId: cart._id });
        await Cart.deleteOne({ _id: cart._id });

        return res.redirect(`${process.env.FE_URL}/user-orders?status=success`);
      } catch (error) {
        return res.status(500).json({
          status: "error",
          code: 500,
          message: "Lỗi hệ thống: " + error.message,
        });
      }
    } else {
      // ================== THANH TOÁN THẤT BẠI ==================
      try {
        const orderCode = vnp_Params["vnp_TxnRef"];
        const order = await Order.findOne({ orderCode });

        if (order) {
          // 1. Lấy cart trước khi xóa
          const cart = await Cart.findOne({ userId: order.userId });
          const cartItems = await CartItem.find({ cartId: cart?._id }).populate(
            "productVariantId"
          );

          // 2. Trả lại reversed stock
          if (cartItems && cartItems.length > 0) {
            for (const item of cartItems) {
              await Inventory.findOneAndUpdate(
                { productVariantId: item.productVariantId._id },
                { $inc: { reversed: -item.quantity } }
              );
            }
          }

          // 3. Nếu là guest → xóa user + address
          if (order.isGuestAccount) {
            await Address.deleteMany({ userId: order.userId });
            await User.deleteOne({ _id: order.userId });
          }

          // 4. Xóa OrderItem, Shipment, History
          await OrderItem.deleteMany({ orderId: order._id });
          await OrderShipment.deleteMany({ orderId: order._id });
          await OrderHistory.deleteMany({ orderId: order._id });

          // 5. Xóa Order
          await Order.deleteOne({ _id: order._id });
        }

        console.log("Thanh toán thất bại → rollback dữ liệu OK");
      } catch (err) {
        console.error("Rollback thất bại:", err);
      }

      return res.redirect(`${process.env.FE_URL}/checkout?status=fail`);
    }
  } else {
    // Sai chữ ký
    console.log("Sai chữ ký");
    return res.redirect(`${process.env.FE_URL}/checkout?status=fail`);
  }
};

module.exports = {
  createVnpayPayment,
  vnpayReturn,
};
