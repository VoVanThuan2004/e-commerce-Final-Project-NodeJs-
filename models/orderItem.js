const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariants",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number, 
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
