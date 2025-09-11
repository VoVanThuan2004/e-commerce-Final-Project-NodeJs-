const nodemailer = require("nodemailer");
require("dotenv").config();

// Khởi tạo transporter với Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// Gửi email chứa mã OTP
const sendCreateAccount = async (to, otp) => {
  const mailOptions = {
    from: `"Hệ thống hỗ trợ" <${process.env.EMAIL}>`,
    to,
    subject: "Tạo tài khoản - Mã OTP",
    html: `
            <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
                <h2>Tạo tài khoản</h2>
                <p>Bạn vừa yêu cầu tạo tài khoản mới.</p>
                <p><strong>Mã OTP của bạn là:</strong></p>
                <div style="font-size: 24px; font-weight: bold; color: #2d8cf0;">${otp}</div>
                <p>Mã OTP này có hiệu lực trong 5 phút.</p>
                <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
                <br/>
                <p>Trân trọng,</p>
                <p>Đội ngũ hỗ trợ</p>
            </div>
        `,
  };

  await transporter.sendMail(mailOptions);
};

const sendRecoveryPassword = async (to, otp) => {
  const mailOptions = {
    from: `"Hệ thống hỗ trợ" <${process.env.EMAIL}>`,
    to,
    subject: "Khôi phục mật khẩu - Mã OTP",
    html: `
            <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
                <h2>Khôi phục mật khẩu</h2>
                <p>Bạn vừa yêu cầu khôi phục mật khẩu cho tài khoản.</p>
                <p><strong>Mã OTP của bạn là:</strong></p>
                <div style="font-size: 24px; font-weight: bold; color: #2d8cf0;">${otp}</div>
                <p>Mã OTP này có hiệu lực trong 5 phút.</p>
                <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
                <br/>
                <p>Trân trọng,</p>
                <p>Đội ngũ hỗ trợ</p>
            </div>
        `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendCreateAccount, sendRecoveryPassword };
