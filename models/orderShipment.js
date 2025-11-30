const mongoose = require("mongoose");

const orderShipmentSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        index: true
    },
    ghnOrderCode: {
        type: String,
        required: true
    },
    serviceId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    fee: {
        type: Number,
        required: true
    },
    expectedDeliveryTime: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model("OrderShipment", orderShipmentSchema);