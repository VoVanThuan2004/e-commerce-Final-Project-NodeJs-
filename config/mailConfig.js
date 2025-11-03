const nodemailer = require("nodemailer");
require("dotenv").config();
const OrderItem = require("../models/orderItem");
const VariantImage = require("../models/variantImage");
const Order = require("../models/order");

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


// Gửi email chứa mật khẩu đăng ký tài khoản mới
const sendAccountPassword = async (to, password) => {
  const mailOptions = {
    from: `"Hệ thống hỗ trợ" <${process.env.EMAIL}>`,
    to,
    subject: "Thông tin tài khoản của bạn",
    html: `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 15px;
        color: #333;
        background-color: #f9fff9;
        border: 1px solid #e0f2e0;
        border-radius: 8px;
        padding: 24px;
        max-width: 600px;
        margin: 0 auto;
      ">
        <h2 style="color: #4CAF50; text-align: center;">🎉 Chào mừng bạn đến với hệ thống!</h2>

        <p>Xin chào,</p>
        <p>Bạn vừa đăng ký tài khoản thành công. Dưới đây là thông tin đăng nhập của bạn:</p>

        <div style="
          background-color: #e8f5e9;
          padding: 16px;
          border-radius: 6px;
          margin: 16px 0;
          border-left: 4px solid #4CAF50;
        ">
          <p style="margin: 0;"><strong>Email:</strong> ${to}</p>
          <p style="margin: 0;"><strong>Mật khẩu tạm thời:</strong> <span style="color: #2e7d32;">${password}</span></p>
        </div>

        <p>🔒 <strong>Lưu ý bảo mật:</strong> Vui lòng đăng nhập và <strong>đổi mật khẩu ngay</strong> để đảm bảo an toàn cho tài khoản của bạn.</p>

        <p>Nếu bạn không yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email này.</p>

        <br/>
        <hr style="border: none; border-top: 1px solid #c8e6c9;"/>
        <p style="font-size: 13px; color: #666; text-align: center;">
          Trân trọng,<br/>
          <strong>Đội ngũ hỗ trợ hệ thống</strong>
        </p>
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

// Gửi email đặt mật khẩu tài khoản mới
const sendPasswordCreateAccount = async (email, token, fullName) => {
  const clientUrl = process.env.FE_URL;
  const setPasswordLink = `${clientUrl}/set-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: `"Hệ thống hỗ trợ" <${process.env.EMAIL}>`,
    to: email,
    subject: "Hoàn tất tài khoản của bạn",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background-color: #007bff; color: white; text-align: center; padding: 20px;">
            <h2 style="margin: 0;">Hệ thống hỗ trợ khách hàng</h2>
          </div>

          <!-- Body -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333;">Chào <strong>${fullName}</strong>,</p>
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              Cảm ơn bạn đã mua hàng tại cửa hàng của chúng tôi.  
              Chúng tôi đã tự động tạo một tài khoản cho bạn.
            </p>
            <p style="font-size: 15px; color: #555; line-height: 1.6;">
              Vui lòng nhấn vào nút bên dưới để <strong>đặt mật khẩu</strong> và truy cập tài khoản của bạn:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${setPasswordLink}"
                 style="background-color: #007bff; color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-size: 16px; display: inline-block;">
                Đặt mật khẩu
              </a>
            </div>

            <p style="font-size: 14px; color: #777;">
              Nếu bạn không thực hiện hành động này, vui lòng bỏ qua email này.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 13px; color: #666;">
            © ${new Date().getFullYear()} Cửa hàng của chúng tôi. Mọi quyền được bảo lưu.<br>
            <a href="${clientUrl}" style="color: #007bff; text-decoration: none;">Truy cập website</a>
          </div>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// Gửi email xác nhận đơn hàng đã đặt
const sendOrderConfirmationEmail = async (order, email, fullName) => {
  try {

    // ===== 2. Lấy danh sách sản phẩm trong đơn hàng =====
    const orderItems = await OrderItem.find({ orderId: order._id }).populate("productVariantId");

    // ===== 3. Lấy 1 ảnh đầu tiên cho từng sản phẩm =====
    const itemsWithImages = await Promise.all(
      orderItems.map(async (item) => {
        const image = await VariantImage.findOne({ productVariantId: item.productVariantId });
        return {
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: image ? image.imageUrl : "https://via.placeholder.com/80x80?text=No+Image",
        };
      })
    );

    // ===== 4. Tạo bảng HTML danh sách sản phẩm =====
    const productRows = itemsWithImages
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">
            <img src="${item.imageUrl}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;" />
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${item.price.toLocaleString()}₫</td>
        </tr>
      `
      )
      .join("");

    // ===== 5. Format lại nội dung email =====
    const mailOptions = {
      from: `"Cửa hàng của chúng tôi" <${process.env.EMAIL}>`,
      to: email,
      subject: `Xác nhận đơn hàng #${order.orderCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 20px;">
          <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: #007bff; color: white; text-align: center; padding: 20px;">
              <h2 style="margin: 0;">Xác nhận đơn hàng</h2>
            </div>

            <div style="padding: 30px;">
              <p>Chào <strong>${fullName}</strong>,</p>
              <p>Cảm ơn bạn đã đặt hàng tại cửa hàng của chúng tôi!</p>
              <p>Mã đơn hàng của bạn là: <strong>${order.orderCode}</strong></p>

              <h3 style="margin-top: 30px;">🧾 Thông tin đơn hàng</h3>
              <p><strong>Ngày đặt:</strong> ${new Date(order.purchaseTime).toLocaleString("vi-VN")}</p>
              <p><strong>Địa chỉ giao hàng:</strong> ${order.addressDetail}, ${order.ward}, ${order.district}, ${order.province}</p>
              <p><strong>Phương thức thanh toán:</strong> ${order.paymentMethod}</p>
              <p><strong>Trạng thái thanh toán:</strong> ${order.paymentStatus}</p>
              <p><strong>Phí vận chuyển:</strong> ${order.shippingFee.toLocaleString()}₫</p>
              <p><strong>Tổng tiền:</strong> <span style="color: #007bff; font-weight: bold;">${order.totalPrice.toLocaleString()}₫</span></p>

              <h3 style="margin-top: 30px;">🛍️ Sản phẩm đặt mua</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                  <tr style="background-color: #f0f0f0;">
                    <th style="padding: 10px;">Ảnh</th>
                    <th style="padding: 10px;">Tên sản phẩm</th>
                    <th style="padding: 10px;">Số lượng</th>
                    <th style="padding: 10px;">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
              </table>

              <p style="margin-top: 30px; color: #555;">
                Bạn có thể kiểm tra trạng thái đơn hàng của mình trong phần "Đơn hàng của tôi" trên website.
              </p>
            </div>

            <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 13px; color: #666;">
              © ${new Date().getFullYear()} Cửa hàng của chúng tôi. Mọi quyền được bảo lưu.
            </div>
          </div>
        </div>
      `,
    };

    // ===== 6. Gửi email =====
    await transporter.sendMail(mailOptions);
    console.log(`Đã gửi email xác nhận đơn hàng #${order.orderCode} đến ${order.userId.email}`);
  } catch (error) {
    console.error("Lỗi gửi email xác nhận đơn hàng:", error.message);
  }
};


module.exports = {
  sendCreateAccount,
  sendRecoveryPassword,
  sendPasswordCreateAccount,
  sendOrderConfirmationEmail,
  sendAccountPassword,
};
