const mongoose = require("mongoose");

const variantAttributeSchema = new mongoose.Schema({
  productVariantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
    index: true,
  },
  attributeValueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AttributeValue",
    required: true,
    index: true,
  },
});

// Tạo compound index trên cả 2 field
variantAttributeSchema.index(
  { productVariantId: 1, attributeValueId: 1 },
  { unique: true }
);

module.exports = mongoose.model("VariantAttribute", variantAttributeSchema);
