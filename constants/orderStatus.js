const OrderStatus  = Object.freeze({
    PENDING: "Đang chờ xử lý",
    COMFIRMED: "Đã xác nhận",
    SHIPPING: "Đang giao hàng",
    DELIVERIED: "Đã nhận hàng",
    PENDING_PAYMENT: "Đang chờ thanh toán"
});

module.exports = OrderStatus;