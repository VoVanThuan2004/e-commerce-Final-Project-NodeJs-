const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true 
    },
    message: { type: String },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "User",
    },
    fullName: { type: String },
}, {
    timestamps: true
});

module.exports = mongoose.model("Review", reviewSchema);