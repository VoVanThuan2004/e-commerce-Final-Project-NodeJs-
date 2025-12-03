const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const auth = require("../middlewares/auth");

// API tạo order (thanh toán)
router.post("/api/v1/orders/payment", orderController.createOrder);

// API lấy danh sách đơn hàng của người dùng
router.get("/api/v1/orders", auth, orderController.getUserOrders);

// API lấy danh sách item trong đơn hàng
router.get("/api/v1/orders/:orderId/items", auth, orderController.getOrderItems);

// API xem chi tiết trạng thái của đơn hàng
router.get("/api/v1/orders/:orderId/status", auth, orderController.getStatusOrders);


/**
    Admin
**/
// API lấy danh sách tất cả đơn hàng
router.get("/api/v2/admin/orders", auth, orderController.getOrdersByAdmin);

// API cập nhật trạng thái đơn hàng
router.put("/api/v1/orders/:orderId/status", auth, orderController.updateStatusOrder);

module.exports = router;
