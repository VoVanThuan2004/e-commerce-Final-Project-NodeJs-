const mongoose = require('mongoose');

const productVariantSchema = new mongoose.Schema({
    name: { type: String, required: true},
    sellingPrice: { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    isActive: { type: Boolean, required: true },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ProductVariant', productVariantSchema);