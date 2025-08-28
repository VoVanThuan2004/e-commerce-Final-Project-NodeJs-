const mongoose = require('mongoose');
require('dotenv').config();

const mongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('MongoDB connected');
    } catch (error) {
        console.log('MongoDB error: ' + error);
    }
}

module.exports = mongoDB;