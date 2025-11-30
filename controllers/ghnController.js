const axios = require("axios");
require("dotenv").config();
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const GHNLocation = require("../models/ghnLocation");
const jwt = require("jsonwebtoken");

const GHN_TOKEN = process.env.GHN_TOKEN;
const GHN_SHOP_ID = parseInt(process.env.GHN_SHOP_ID);
const GHN_URL = process.env.GHN_URL;
const FROM_DISTRICT_ID = 1449;
const FROM_WARD_CODE = "20706";

const headers = {
  Token: GHN_TOKEN,
  ShopId: GHN_SHOP_ID,
  "Content-Type": "application/json",
};

const getShippingFee = async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || !address.wardCode || !address.districtCode) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Thiếu thông tin địa chỉ",
      });
    }

    let userId = null;
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      userId = decoded.userId;
    }
    const sessionId = req.body.sessionId || null;

    console.log(userId);

    // 1. Lấy giỏ hàng
    let cart;
    if (userId) {
      cart = await Cart.findOne({ userId });
    } else if (sessionId) {
      cart = await Cart.findOne({ sessionId });
    } else {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Thiếu sessionId cho guest",
      });
    }

    if (!cart) {
      return res.status(400).json({
        status: "error",
        code: 404,
        message: "Giỏ hàng trống",
      });
    }

    const cartItems = await CartItem.find({ cartId: cart._id }).populate(
      "productVariantId",
      "weight length width height name"
    );

    if (cartItems.length === 0) {
      return res
        .status(400)
        .json({ status: "error", code: 400, message: "Giỏ hàng trống" });
    }

    // 2. Tính trọng lượng + kích thước
    let totalWeight = 0;
    let maxLength = 20,
      maxWidth = 15,
      maxHeight = 10;
    const items = [];

    cartItems.forEach((item) => {
      const v = item.productVariantId;
      const weight = v.weight || 500;
      totalWeight += weight * item.quantity;

      maxLength = Math.max(maxLength, v.length || 20);
      maxWidth = Math.max(maxWidth, v.width || 15);
      maxHeight = Math.max(maxHeight, v.height || 10);

      items.push({
        name: v.name || "Sản phẩm",
        quantity: item.quantity,
        weight: weight,
        length: v.length || 20,
        width: v.width || 15,
        height: v.height || 10,
      });
    });

    const weightInGram = Math.max(1000, Math.ceil(totalWeight));

    // 3. CHUẨN HÓA TÊN ĐỊA CHỈ ĐỂ TÌM KIẾM
    const normalizeName = (name) => {
      if (!name) return "";

      return name
        .toLowerCase()
        .normalize("NFD") // Tách dấu
        .replace(/[\u0300-\u036f]/g, "") // Xóa dấu
        .replace(/(thành phố|tp\.?|t\.p|tpho)/g, "") // Loại bỏ từ chỉ thành phố
        .replace(/(quận|q\.?|huyện|h\.?|thị xã|tx\.?)/g, "") // Loại bỏ từ chỉ quận/huyện
        .replace(/(phường|p\.?|xã|thị trấn|tt\.?)/g, "") // Loại bỏ từ chỉ phường/xã
        .replace(/[^\w\s]/g, "") // Xóa ký tự đặc biệt
        .trim();
    };

    // Tìm province - sử dụng regex linh hoạt hơn
    const normalizedProvince = normalizeName(address.province);

    const ghnLocation = await GHNLocation.findOne({
      $or: [
        { province_name: { $regex: normalizedProvince, $options: "i" } },
        {
          province_name: {
            $regex: address.province
              .replace("Thành phố", "")
              .replace("Tỉnh", "")
              .trim(),
            $options: "i",
          },
        },
      ],
    });

    if (!ghnLocation) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Không hỗ trợ giao đến ${address.province}`,
      });
    }

    // Tìm district
    const normalizedDistrict = normalizeName(address.district);

    const targetDistrict = ghnLocation.districts.find((d) => {
      const ghnDistrictNormalized = normalizeName(d.district_name);

      // So sánh nhiều cách
      const exactMatch = ghnDistrictNormalized === normalizedDistrict;
      const includesMatch =
        ghnDistrictNormalized.includes(normalizedDistrict) ||
        normalizedDistrict.includes(ghnDistrictNormalized);

      // Thêm so sánh với tên gốc (không chuẩn hóa)
      const originalMatch =
        d.district_name
          .toLowerCase()
          .includes(address.district.toLowerCase()) ||
        address.district.toLowerCase().includes(d.district_name.toLowerCase());

      return exactMatch || includesMatch || originalMatch;
    });

    if (!targetDistrict) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Không tìm thấy quận/huyện: ${address.district} trong hệ thống GHN`,
      });
    }

    // Tìm ward
    const normalizedWard = normalizeName(address.ward);

    const targetWard = targetDistrict.wards.find((w) => {
      const ghnWardNormalized = normalizeName(w.ward_name);

      // So sánh nhiều cách
      const exactMatch = ghnWardNormalized === normalizedWard;
      const includesMatch =
        ghnWardNormalized.includes(normalizedWard) ||
        normalizedWard.includes(ghnWardNormalized);

      // Thêm so sánh với tên gốc
      const originalMatch =
        w.ward_name.toLowerCase().includes(address.ward.toLowerCase()) ||
        address.ward.toLowerCase().includes(w.ward_name.toLowerCase());

      return exactMatch || includesMatch || originalMatch;
    });

    if (!targetWard) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Không tìm thấy phường/xã: ${address.ward} trong hệ thống GHN`,
      });
    }

    const to_district_id = targetDistrict.district_id;
    const to_ward_code = targetWard.ward_code;

    // 4. GỌI API GHN
    const payload = {
      service_id: 53321,
      service_type_id: 2,
      from_district_id: FROM_DISTRICT_ID,
      from_ward_code: FROM_WARD_CODE,
      to_district_id,
      to_ward_code,
      weight: weightInGram,
      length: maxLength,
      width: maxWidth,
      height: maxHeight,
      insurance_value: 0,
      items,
    };

    const response = await axios.post(
      GHN_URL + "/v2/shipping-order/fee",
      payload,
      { headers }
    );

    if (response.data.code !== 200) {
      console.log("GHN API Error:", response.data);
      return res.status(400).json({
        status: "error",
        code: 400,
        message: response.data.message || "Không thể tính phí vận chuyển",
        code_message: response.data.code_message,
        data: null,
      });
    }

    const feeData = response.data.data;

    return res.status(200).json({
      status: "success",
      code: 200,
      data: {
        fee: feeData.total,
        estimated_days: feeData.leadtime
          ? new Date(feeData.leadtime * 1000).toLocaleDateString("vi-VN")
          : "3-5 ngày",
        service_id: feeData.service_id,
        service_name: "Giao hàng tiêu chuẩn",
        district_name: targetDistrict.district_name,
        ward_name: targetWard.ward_name,
        note: "Phí vận chuyển đã được tính toán thành công",
      },
    });
  } catch (error) {
    console.log("System Error:", error.response?.data || error.message);
    return res.status(500).json({
      status: "error",
      code: 500,
      message:
        "Lỗi hệ thống: " + (error.response?.data?.message || error.message),
      data: null,
    });
  }
};

// Chạy script kiểm tra nhanh
const checkDistrict = async (req, res) => {
  const districtCode = 1454; // districtCode của Quận 7 từ API địa chỉ Việt Nam
  const result = await GHNLocation.findOne({
    "districts.district_id": districtCode,
  });

  if (result) {
    const district = result.districts.find(
      (d) => d.district_id === districtCode
    );
    console.log("Tìm thấy district:", {
      district_id: district.district_id,
      district_name: district.district_name,
      wards_count: district.wards.length,
    });

    return res.status(200).json({
      district_id: district.district_id,
      district_name: district.district_name,
      wards_count: district.wards.length,
    });
  } else {
    console.log("Không tìm thấy district với id:", districtCode);
    return res.status(500).json({
      message: "error",
    });
  }
};

module.exports = {
  getShippingFee,
  checkDistrict,
};
