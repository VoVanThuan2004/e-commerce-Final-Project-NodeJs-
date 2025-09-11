const mongoose = require("mongoose");

const socialAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: { type: String, required: true, index: true },
    provider_user_id: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SocialAccount', socialAccountSchema);
