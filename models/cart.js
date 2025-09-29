const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    sessionId: { type: String, default: null },
    expires_at: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Tạo TTL (Time to Live) thời gian sống, mongo sẽ tự xóa schema nếu hết hạn
cartSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Cart", cartSchema);
