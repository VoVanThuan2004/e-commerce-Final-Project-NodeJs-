// models/GHNLocation.js
const mongoose = require("mongoose");

const wardSchema = new mongoose.Schema({
  ward_code: { type: String, required: true },
  ward_name: { type: String, required: true },
});

const districtSchema = new mongoose.Schema({
  district_id: { type: Number, required: true },
  district_name: { type: String, required: true },
  wards: [wardSchema],
});

const ghnLocationSchema = new mongoose.Schema({
  province_id: { type: Number, required: true, unique: true },
  province_name: { type: String, required: true },
  districts: [districtSchema],
});

module.exports = mongoose.model("GHNLocation", ghnLocationSchema);