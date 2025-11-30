const mongoose = require('mongoose');

const attributeSchema = new mongoose.Schema({
    attributeName: {
        type: String,
        required: true,
    },
    order: {
        type: Number,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Attribute', attributeSchema);