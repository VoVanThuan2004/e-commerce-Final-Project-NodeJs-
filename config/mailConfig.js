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
  const setPasswordLink = `${clientUrl}/set-password?email=${encodeURIComponent(
    email
  )}&token=${encodeURIComponent(token)}`;

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
    console.log("Order ID:", order._id);
    console.log("Order Code:", order.orderCode);

    // ===== LẤY OrderItem + ảnh đầu tiên từ VariantImages =====
    const orderItemsWithImages = await OrderItem.aggregate([
      { $match: { orderId: order._id } },
      {
        $lookup: {
          from: "variantimages", // nếu collection tên là variantimage (không có s) thì sửa thành "variantimage"
          localField: "productVariantId",
          foreignField: "productVariantId",
          as: "variantImages",
          pipeline: [
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
            { $project: { imageUrl: 1, _id: 0 } },
          ],
        },
      },
      {
        $addFields: {
          imageUrl: { $arrayElemAt: ["$variantImages.imageUrl", 0] },
        },
      },
      {
        $project: {
          name: 1,
          price: 1,
          quantity: 1,
          imageUrl: {
            $ifNull: [
              "$imageUrl",
              "https://via.placeholder.com/80x80/eeeeee/999999?text=SP",
            ],
          },
        },
      },
    ]);

    console.log(`Tìm thấy ${orderItemsWithImages.length} sản phẩm trong đơn`);

    // ===== TẠO DÒNG SẢN PHẨM TRONG EMAIL =====
    const productRows = orderItemsWithImages
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            <img src="${item.imageUrl}" 
                 alt="${item.name}" 
                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;"
                 onerror="this.src='https://via.placeholder.com/80x80/eee/ccc?text=SP'" />
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 15px;">${
            item.name
          }</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${
            item.quantity
          }</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${item.price.toLocaleString()}₫</td>
        </tr>
      `
      )
      .join("");

    const finalProductRows =
      productRows ||
      `<tr>
        <td colspan="4" style="padding: 30px; text-align: center; color: #999; font-style: italic;">
          Không tải được danh sách sản phẩm
        </td>
      </tr>`;

    // ===== NỘI DUNG EMAIL HOÀN CHỈNH =====
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Xác nhận đơn hàng #${order.orderCode}</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
          .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; text-align: center; }
          .content { padding: 35px; }
          h2, h3 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin: 25px 0; }
          th { background-color: #f8f9fa; text-align: left; padding: 12px; font-weight: 600; }
          td { padding: 12px; }
          .total { font-size: 18px; font-weight: bold; color: #007bff; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>XÁC NHẬN ĐƠN HÀNG</h2>
            <p style="margin: 10px 0 0; font-size: 16px;">Mã đơn hàng: <strong>#${
              order.orderCode
            }</strong></p>
          </div>

          <div class="content">
            <p>Xin chào <strong>${fullName}</strong>,</p>
            <p>Cảm ơn bạn đã tin tưởng và đặt hàng tại <strong>Cửa hàng của chúng tôi</strong>!</p>
            <p>Chúng tôi đã nhận được đơn hàng của bạn và đang xử lý trong thời gian sớm nhất.</p>

            <h3>Thông tin đơn hàng</h3>
            <p><strong>Ngày đặt:</strong> ${new Date(
              order.purchaseTime
            ).toLocaleString("vi-VN")}</p>
            <p><strong>Địa chỉ giao hàng:</strong><br>${order.addressDetail}, ${
      order.ward
    }, ${order.district}, ${order.province}</p>
            <p><strong>Phương thức thanh toán:</strong> ${
              order.paymentMethod === "CASH"
                ? "Thanh toán khi nhận hàng (COD)"
                : "Đã thanh toán online"
            }</p>
            <p><strong>Trạng thái thanh toán:</strong> 
              <span style="color: ${
                order.paymentStatus === "PAID" ? "#28a745" : "#ffc107"
              }; font-weight: bold;">
                ${
                  order.paymentStatus === "PAID"
                    ? "Đã thanh toán"
                    : "Chưa thanh toán"
                }
              </span>
            </p>
            <p><strong>Phí vận chuyển:</strong> ${order.shippingFee.toLocaleString()}₫</p>
            <p class="total"><strong>Tổng tiền:</strong> ${order.totalPrice.toLocaleString()}₫</p>

            <h3>Sản phẩm đã đặt</h3>
            <table>
              <thead>
                <tr style="background-color: #f8f9fa;">
                  <th style="width: 100px;">Ảnh</th>
                  <th>Tên sản phẩm</th>
                  <th style="width: 100px;">Số lượng</th>
                  <th style="width: 120px;">Giá</th>
                </tr>
              </thead>
              <tbody>
                ${finalProductRows}
              </tbody>
            </table>

            <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #555;">
                Bạn có thể theo dõi trạng thái đơn hàng tại <strong>"Đơn hàng của tôi"</strong> trên website của chúng tôi.
              </p>
            </div>
          </div>

          <div class="footer">
            <p>© ${new Date().getFullYear()} Cửa hàng của chúng tôi. Mọi quyền được bảo lưu.</p>
            <p style="margin: 8px 0 0; font-size: 12px;">
              Nếu bạn không đặt đơn hàng này, vui lòng liên hệ ngay với chúng tôi.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Cửa hàng của chúng tôi" <${process.env.EMAIL}>`,
      to: email,
      subject: `Xác nhận đơn hàng #${order.orderCode} thành công`,
      html,
    });

    console.log(
      `Đã gửi email xác nhận đơn hàng #${order.orderCode} đến ${email}`
    );
  } catch (error) {
    console.error("Lỗi gửi email xác nhận đơn hàng:", error.message);
    // Không throw để không làm hỏng flow đặt hàng
  }
};

// Gửi email thông báo tạo tài khoản + mật khẩu tạm sau khi guest đặt hàng thành công
const sendAccountPasswordAfterOrder = async (email, password, fullName, orderCode) => {
  try {
    const clientUrl = process.env.FE_URL || "https://yourwebsite.com";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Tài khoản của bạn đã được tạo!</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px; }
          .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 25px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #4CAF50, #388e3c); color: white; padding: 35px 30px; text-align: center; }
          .content { padding: 35px 40px; color: #333; line-height: 1.7; }
          .highlight-box { background-color: #e8f5e9; border-left: 5px solid #4CAF50; padding: 20px; border-radius: 0 8px 8px 0; margin: 25px 0; }
          .login-info { background-color: #f8fff8; padding: 18px; border-radius: 8px; font-family: Consolas, monospace; }
          .btn { display: inline-block; background-color: #4CAF50; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 25px; text-align: center; font-size: 13px; color: #666; border-top: 1px solid #eee; }
          h1, h2, h3 { margin: 0 0 15px 0; }
          .success-icon { font-size: 50px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="success-icon">Checkmark</div>
            <h1>Chúc mừng bạn đã có tài khoản!</h1>
            <p style="margin: 10px 0; font-size: 17px; opacity: 0.95;">
              Đơn hàng <strong>#${orderCode}</strong> đã được đặt thành công
            </p>
          </div>

          <!-- Nội dung chính -->
          <div class="content">
            <p>Xin chào <strong>${fullName}</strong>,</p>
            
            <p>Cảm ơn bạn đã tin tưởng mua sắm tại <strong>cửa hàng của chúng tôi</strong>!</p>
            
            <p>Chúng tôi đã <strong>tự động tạo tài khoản</strong> cho bạn bằng chính email này để bạn có thể:</p>
            <ul style="margin: 20px 0; padding-left: 20px;">
              <li>Theo dõi trạng thái đơn hàng một cách dễ dàng</li>
              <li>Xem lại lịch sử mua hàng</li>
              <li>Nhận ưu đãi dành riêng cho thành viên</li>
              <li>Mua sắm nhanh hơn ở những lần sau</li>
            </ul>

            <div class="highlight-box">
              <h3 style="margin-top: 0; color: #2e7d32;">Thông tin đăng nhập của bạn</h3>
              <div class="login-info">
                <p style="margin: 8px 0;"><strong>Email:</strong> <span style="color: #1976d2;">${email}</span></p>
                <p style="margin: 8px 0;"><strong>Mật khẩu tạm thời:</strong> 
                  <span style="color: #d32f2f; font-weight: bold; letter-spacing: 1px;">${password}</span>
                </p>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${clientUrl}/login" class="btn">Đăng nhập ngay</a>
            </div>

            <p style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; color: #856404;">
              <strong>Lưu ý quan trọng:</strong> Vì lý do bảo mật, vui lòng <strong>đăng nhập và đổi mật khẩu ngay lần đầu</strong> để bảo vệ tài khoản của bạn.
            </p>

            <p>Nếu bạn không đặt hàng hoặc không muốn sử dụng tài khoản này, bạn có thể bỏ qua email này một cách an toàn.</p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p><strong>Cửa hàng của chúng tôi</strong> – Đồng hành cùng mọi hành trình mua sắm của bạn</p>
            <p style="margin: 10px 0 0;">
              <a href="${clientUrl}" style="color: #4CAF50; text-decoration: none;">Truy cập website</a> • 
              <a href="mailto:support@yourstore.com" style="color: #4CAF50; text-decoration: none;">Liên hệ hỗ trợ</a>
            </p>
            <p style="margin-top: 15px; font-size: 12px; color: #999;">
              © ${new Date().getFullYear()} Cửa hàng của chúng tôi. Tất cả quyền được bảo lưu.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Cửa hàng của chúng tôi" <${process.env.EMAIL}>`,
      to: email,
      subject: `Tài khoản của bạn đã được tạo • Đơn hàng #${orderCode}`,
      html,
    });

    console.log(`Đã gửi email tạo tài khoản thành công đến ${email} (Đơn #${orderCode})`);
  } catch (error) {
    console.error("Lỗi gửi email tạo tài khoản sau đặt hàng:", error.message);
    // Không throw để không làm gián đoạn flow đặt hàng
  }
};

module.exports = {
  sendCreateAccount,
  sendRecoveryPassword,
  sendPasswordCreateAccount,
  sendOrderConfirmationEmail,
  sendAccountPassword,
  sendAccountPasswordAfterOrder
};
