const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  cartId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cart",
    index: true,
  },
  productVariantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant",
  },
  quantity: { type: Number },
});

cartItemSchema.index({ cartId: 1, productVariantId: 1 });
module.exports = mongoose.model("CartItem", cartItemSchema);
