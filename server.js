const express = require('express');
const app = express();
const cors = require('cors');
const mongoDB = require('./config/mongoDB');
require('dotenv').config();
const initAdminAccount = require('./init');

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

// Kết nối Server
app.listen(() => {
    console.log(`http://localhost:${process.env.PORT}`);
}) 