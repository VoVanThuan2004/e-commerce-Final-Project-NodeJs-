const OrderStatus  = Object.freeze({
    PENDING: "Đang chờ xử lý",
    COMFIRMED: "Đã xác nhận",
    SHIPPING: "Đang giao hàng",
    DELIVERIED: "Đã nhận hàng"
});

module.exports = OrderStatus;