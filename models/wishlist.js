const mongoose = require("mongoose");

const wishListSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
}, {
    timestamps: true
});

// Tạo compound index trên cả 2 field
wishListSchema.index(
  { userId: 1, productId: 1 },
  { unique: true }
);

module.exports = mongoose.model("WishList", wishListSchema);
