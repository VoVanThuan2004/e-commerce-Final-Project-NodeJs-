const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Thiếu mã xác thực (Authorization token)",
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Access Denied",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; // Gán vào req.user để dùng ở route khác
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        code: 401,
        message: "Token đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Token không hợp lệ",
      error: error.message,
    });
  }
};
