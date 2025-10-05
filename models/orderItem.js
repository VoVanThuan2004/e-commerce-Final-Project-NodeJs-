const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productVariantId: {
      type: Number,
      ref: "ProductVariants",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: String, // Lưu ý: price được định nghĩa là varchar trong yêu cầu
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OrderItem", orderItemSchema);
