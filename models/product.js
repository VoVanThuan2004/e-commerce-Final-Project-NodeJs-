const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    description: { type: String, required: true },
    defaultImage: { type: String, required: true },
    defaultImagePublicId: { type: String, required: true },
    status: { type: Boolean, default: true},
    brandId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        index: true,
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema);