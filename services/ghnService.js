const axios = require("axios");
require("dotenv").config();
const GHNLocation = require("../models/ghnLocation");

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

const createGHNOrder = async (orderInfo) => {
  try {
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
    const normalizedProvince = normalizeName(orderInfo.to_province);

    const ghnLocation = await GHNLocation.findOne({
      $or: [
        { province_name: { $regex: normalizedProvince, $options: "i" } },
        {
          province_name: {
            $regex: orderInfo.to_province
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
        message: `Không hỗ trợ giao đến ${orderInfo.to_province}`,
      });
    }

    // Tìm district
    const normalizedDistrict = normalizeName(orderInfo.to_district);

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
          .includes(orderInfo.to_district.toLowerCase()) ||
        orderInfo.to_district.toLowerCase().includes(d.district_name.toLowerCase());

      return exactMatch || includesMatch || originalMatch;
    });

    if (!targetDistrict) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Không tìm thấy quận/huyện: ${orderInfo.to_district} trong hệ thống GHN`,
      });
    }

    // Tìm ward
    const normalizedWard = normalizeName(orderInfo.to_ward);

    const targetWard = targetDistrict.wards.find((w) => {
      const ghnWardNormalized = normalizeName(w.ward_name);

      // So sánh nhiều cách
      const exactMatch = ghnWardNormalized === normalizedWard;
      const includesMatch =
        ghnWardNormalized.includes(normalizedWard) ||
        normalizedWard.includes(ghnWardNormalized);

      // Thêm so sánh với tên gốc
      const originalMatch =
        w.ward_name.toLowerCase().includes(orderInfo.to_ward.toLowerCase()) ||
        orderInfo.to_ward.toLowerCase().includes(w.ward_name.toLowerCase());

      return exactMatch || includesMatch || originalMatch;
    });

    if (!targetWard) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: `Không tìm thấy phường/xã: ${orderInfo.to_ward} trong hệ thống GHN`,
      });
    }

    const to_district_id = targetDistrict.district_id;
    const to_ward_code = targetWard.ward_code;



    const response = await axios.post(
      `${GHN_URL}/v2/shipping-order/create`,
      {
        payment_type_id: 2, // người nhận trả phí
        note: orderInfo.note || "Đơn hàng từ hệ thống",
        required_note: "KHONGCHOXEMHANG",
        from_name: "Shop Lucky",
        from_phone: "0935148429",
        from_address:
          "19 Nguyễn Hữu Thọ, Phường Tân Phong, Quận 7, Thành phố Hồ Chí Minh",
        from_ward_name: "Phường Tân Phong",
        from_district_name: "Quận 7",
        from_province_name: "Thành phố Hồ Chí Minh",
        return_phone: "0935148429",
        return_address:
          "19 Nguyễn Hữu Thọ, Phường Tân Phong, Quận 7, Thành phố Hồ Chí Minh",
        to_name: orderInfo.to_name,
        to_phone: orderInfo.to_phone,
        to_address: orderInfo.to_address,
        to_ward_code: to_ward_code,
        to_district_id: to_district_id,
        cod_amount: orderInfo.cod_amount,
        content: orderInfo.content || "Đơn hàng GHN",
        weight: orderInfo.weight || 500,
        length: orderInfo.length || 20,
        width: orderInfo.width || 20,
        height: orderInfo.height || 10,
        service_id: 53321,
        service_type_id: 2,
        items: orderInfo.items,
      },
      {
        headers: {
          "Content-Type": "application/json",
          ShopId: process.env.GHN_SHOP_ID,
          Token: process.env.GHN_TOKEN,
        },
      }
    );

    return {
      code: response.data.code,
      message: response.data.message,
      data: response.data.data,
    };
  } catch (error) {
    console.error("GHN API Error:", error.response?.data || error.message);
    throw new Error("Không thể tạo đơn hàng GHN");
  }
};

const calculateGHNShippingFee = async (orderInfo) => {
  try {
    const response = await axios.post(
      `${process.env.GHN_URL}/v2/shipping-order/fee`,
      {
        // Địa chỉ lấy hàng (từ shop của bạn)
        from_district_id: 1449,
        from_ward_code: "20706",

        // Thông tin giao hàng
        service_id: 53321, // Dịch vụ tiêu chuẩn
        service_type_id: 2,
        to_district_id: Number(orderInfo.to_district_id),
        to_ward_code: orderInfo.to_ward_code,

        // Kích thước & trọng lượng
        height: orderInfo.height || 10,
        length: orderInfo.length || 20,
        weight: orderInfo.weight || 200,
        width: orderInfo.width || 20,

        // Giá trị đơn hàng & các thông tin thêm
        insurance_value: orderInfo.insurance_value || 0,
        cod_failed_amount: 0,
        coupon: null,

        // Danh sách sản phẩm
        items: orderInfo.items || [],
      },
      {
        headers: {
          "Content-Type": "application/json",
          ShopId: process.env.GHN_SHOP_ID,
          Token: process.env.GHN_TOKEN,
        },
      }
    );

    // Trả kết quả chuẩn hóa lại
    return {
      code: response.data.code,
      message: response.data.message,
      data: response.data.data, // gồm: total, service_fee, insurance_fee, ...
    };
  } catch (error) {
    console.error("GHN Fee API Error:", error.response?.data || error.message);
    throw new Error("Không thể tính phí ship cho đơn hàng");
  }
};

const calculateGHNShippingFeeV2 = async (
  totalWeight,
  totalWidth,
  totalLength,
  totalHeight,
  address,
  items
) => {
  try {
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
      weight: totalWeight,
      length: totalLength,
      width: totalWidth,
      height: totalHeight,
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
    }

    // Trả kết quả chuẩn hóa lại
    return {
      code: response.data.code,
      message: response.data.message,
      data: response.data.data, // gồm: total, service_fee, insurance_fee, ...
    };
  } catch (error) {
    console.error("GHN Fee API Error:", error.response?.data || error.message);
    throw new Error("Không thể tính phí ship cho đơn hàng");
  }
};

module.exports = {
  createGHNOrder,
  calculateGHNShippingFee,
  calculateGHNShippingFeeV2,
};
