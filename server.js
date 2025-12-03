const express = require("express");
const app = express();
const cors = require("cors");
const mongoDB = require("./config/mongoDB");
require("dotenv").config();
const initAdminAccount = require("./init");
const userRouter = require("./routers/userRouter");
const brandRouter = require("./routers/brandRouter");
const categoryRouter = require("./routers/categoryRouter");
const attributeRouter = require("./routers/attributeRouter");
const attributeValueRouter = require("./routers/attributeValueRouter");
const productRouter = require("./routers/productRouter");
const productVariantRouter = require("./routers/productVariantRouter");
const reviewRouter = require("./routers/reviewRouter");
const ratingRouter = require("./routers/ratingRouter");
const couponRouter = require("./routers/couponRouter");
const wishListRouter = require("./routers/wishListRouter");
const addressRouter = require("./routers/addressRouter");
const createIndexES = require("./config/createIndexES");
const { initSocket } = require("./config/socket");
const http = require("http");
const PORT = process.env.PORT;
const session = require("express-session");
const cartRouter = require("./routers/cartRouter");
const orderRouter = require("./routers/orderRouter");
const paymentRouter = require("./routers/paymentRouter");
const dashboardRouter = require("./routers/dashboardRouter");
const authRouter = require("./routers/authRouter");
const  syncGHNLocations = require("./services/syncGHNLocations");
const ghnRouter = require("./routers/ghnRouter");

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
initSocket(server); // Khởi tạo socket với server

// Kết nói mongo database
mongoDB();

// chạy khởi tạo mặc định
(async () => {
  try {
    await initAdminAccount();
    await createIndexES();
    await syncGHNLocations();
  } catch (error) {
    console.error("Error during role/admin init:", error);
  }
})();

// router
app.use(userRouter);
app.use(brandRouter);
app.use(categoryRouter);
app.use(attributeRouter);
app.use(attributeValueRouter);
app.use(productRouter);
app.use(productVariantRouter);
app.use(reviewRouter);
app.use(ratingRouter);
app.use(couponRouter);
app.use(wishListRouter);
app.use(addressRouter);
app.use(cartRouter);
app.use(orderRouter);
app.use(paymentRouter);
app.use(authRouter);
app.use(dashboardRouter);
app.use(ghnRouter);

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});