const mongoose = require('mongoose');

const attributeValueSchema = new mongoose.Schema({
    attributeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attribute',
        required: true,
        index: true
    },
    value: {
        type: String,
        required: true,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AttributeValue', attributeValueSchema);