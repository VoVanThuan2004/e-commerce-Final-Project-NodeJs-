const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    couponCode: { type: String, required: true },
    discountPrice: { type: Number, required: true },
    usageLimit: { type: Number, required: true },
    usedCount: { type: Number, default: 0 },
}, {
    timestamps: true 
});

module.exports = mongoose.model("Coupon", couponSchema);