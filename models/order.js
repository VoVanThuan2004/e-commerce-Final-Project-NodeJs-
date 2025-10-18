const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      index: true,
    },
    ghnOrderCode: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    wardCode: { type: String, required: true },
    ward: { type: String, required: true },
    districtCode: { type: String, required: true },
    district: { type: String, required: true },
    provinceCode: { type: String, required: true },
    province: { type: String, required: true },
    addressDetail: { type: String, required: true },
    totalPrice: {
      type: Number,
      required: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
    },
    couponCode: {
      type: String,
      default: null
    },
    discountPrice: {
      type: Number,
      default: 0,
    },
    currentStatus: {
      type: String,
      required: true,
    },
    purchaseTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentStatus: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    vnpBankTranNo: {
      type: String,
    },
    vnpTransactionNo: {
      type: String,
    },
    serviceId: {
      type: String,
      required: true,
    },
    shippingFee: {
      type: Number,
    },
    estimatedDelivery: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
