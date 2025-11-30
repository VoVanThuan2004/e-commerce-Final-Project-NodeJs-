const mongoose = require("mongoose");

const variantImageSchema = new mongoose.Schema({
  productVariantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
    index: true,
  },
  imageUrl: { type: String, required: true },
  imageUrlPublicId: { type: String, required: true },
});

module.exports = mongoose.model('VariantImage', variantImageSchema);
