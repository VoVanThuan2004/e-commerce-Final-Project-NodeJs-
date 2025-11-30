const mongoose = require("mongoose");

const orderHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
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

module.exports = mongoose.model("OrderHistory", orderHistorySchema);
