const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    wardCode: { type: String, required: true },
    ward: { type: String, required: true },
    districtCode: { type: String, required: true },
    district: { type: String, required: true },
    provinceCode: { type: String, required: true },
    province: { type: String, required: true },
    addressDetail: { type: String, required: true },
    isDefault: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Address || mongoose.model("Address", addressSchema);
