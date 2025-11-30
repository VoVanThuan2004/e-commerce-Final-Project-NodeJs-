// utils/syncGHNLocations.js
const axios = require("axios");
const GHNLocation = require("../models/ghnLocation"); // Đảm bảo tên model đúng (viết hoa G)
require("dotenv").config();

const GHN_TOKEN = process.env.GHN_TOKEN;
const GHN_SHOP_ID = process.env.GHN_SHOP_ID; // BẮT BUỘC cho môi trường dev
const GHN_BASE_URL = process.env.GHN_URL; // URL gốc

// Kiểm tra biến môi trường
if (!GHN_TOKEN || !GHN_SHOP_ID) {
  console.error("THIẾU GHN_TOKEN hoặc GHN_SHOP_ID trong .env");
  process.exit(1);
}

const syncGHNLocations = async () => {
  try {
    console.log("Bắt đầu đồng bộ dữ liệu GHN (Dev Environment)...");

    // Kiểm tra đã có dữ liệu chưa
    const existingCount = await GHNLocation.countDocuments();
    if (existingCount >= 63) {
      console.log(`Dữ liệu GHN đã tồn tại (63 tỉnh), bỏ qua đồng bộ.`);
      return;
    }

    console.log("Chưa có dữ liệu → Bắt đầu tải từ GHN...");

    // Header chung cho tất cả request (DEV BẮT BUỘC có ShopId)
    const headers = {
      Token: GHN_TOKEN,
      ShopId: parseInt(GHN_SHOP_ID), // PHẢI có + phải là số
      "Content-Type": "application/json",
    };

    // 1. Lấy danh sách tỉnh
    console.log("Bước 1: Lấy danh sách tỉnh...");
    const provinceRes = await axios.get(
      `${GHN_BASE_URL}/master-data/province`,
      { headers }
    );

    const provinces = provinceRes.data.data;
    console.log(`Đã lấy được ${provinces.length} tỉnh`);

    for (let i = 0; i < provinces.length; i++) {
      const prov = provinces[i];
      console.log(`[${i + 1}/63] Đang xử lý: ${prov.ProvinceName}`);

      // 2. Lấy quận/huyện
      const districtRes = await axios.post(
        `${GHN_BASE_URL}/master-data/district`,
        { province_id: prov.ProvinceID },
        { headers }
      );

      const districts = districtRes.data.data || [];
      const districtsWithWards = [];

      for (const dist of districts) {
        try {
          // 3. Lấy phường/xã
          const wardRes = await axios.post(
            `${GHN_BASE_URL}/master-data/ward`,
            { district_id: dist.DistrictID },
            { headers }
          );

          districtsWithWards.push({
            district_id: dist.DistrictID,
            district_name: dist.DistrictName,
            wards: (wardRes.data.data || []).map(w => ({
              ward_code: w.WardCode,
              ward_name: w.WardName,
            })),
          });
        } catch (wardError) {
          console.warn(`Không lấy được phường/xã của ${dist.DistrictName}`);
          districtsWithWards.push({
            district_id: dist.DistrictID,
            district_name: dist.DistrictName,
            wards: [],
          });
        }
      }

      // Lưu vào DB
      await GHNLocation.findOneAndUpdate(
        { province_id: prov.ProvinceID },
        {
          province_id: prov.ProvinceID,
          province_name: prov.ProvinceName,
          districts: districtsWithWards,
        },
        { upsert: true, new: true }
      );
    }

    console.log("HOÀN TẤT! Đã đồng bộ thành công toàn bộ 63 tỉnh GHN vào database");
  } catch (error) {
    console.error("LỖI ĐỒNG BỘ GHN:", {
      message: error.response?.data?.message || error.message,
      status: error.response?.status,
      url: error.config?.url,
    });
  }
};

module.exports = syncGHNLocations;