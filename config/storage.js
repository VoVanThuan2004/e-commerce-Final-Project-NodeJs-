const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "e-commerce nodejs", // Thư mục trong Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"], // định dạng cho phép
  },
});

module.exports = storage;
