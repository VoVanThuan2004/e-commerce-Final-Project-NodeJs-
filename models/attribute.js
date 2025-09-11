const mongoose = require('mongoose');

const attributeSchema = new mongoose.Schema({
    attributeName: {
        type: String,
        required: true,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Attribute', attributeSchema);