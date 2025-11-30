const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true },
    reversed: { type: Number, default: 0 },
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Inventory", inventorySchema);
