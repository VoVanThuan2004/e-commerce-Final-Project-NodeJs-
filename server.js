const express = require('express');
const app = express();
const cors = require('cors');
const mongoDB = require('./config/mongoDB');
require('dotenv').config();
const initAdminAccount = require('./init');
const userRouter = require('./routers/userRouter');
const brandRouter = require('./routers/brandRouter');
const categoryRouter = require('./routers/categoryRouter');
const attributeRouter = require('./routers/attributeRouter');
const attributeValueRouter = require('./routers/attributeValueRouter');

const PORT = process.env.PORT;
app.use(cors());
app.use(express.json());

// Kết nói mongo database
mongoDB();

// chạy khởi tạo mặc định
(async () => {
    try {
        await initAdminAccount();
    } catch (error) {
        console.error('Error during role/admin init:', error);
    }
})();

// router
app.use(userRouter);
app.use(brandRouter);
app.use(categoryRouter);
app.use(attributeRouter);
app.use(attributeValueRouter);

// Kết nối Server
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
}) 