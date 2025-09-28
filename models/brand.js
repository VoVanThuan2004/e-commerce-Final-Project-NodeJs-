const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
    {
        brandName: { type: String, required: true },
        logo: { type: String },
        logoPublicId: { type: String }
    },
    {
        timestamps: true 
    }
);

module.exports = mongoose.model('Brand', brandSchema);