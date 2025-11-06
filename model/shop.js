const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
  platform: { type: String, default: "TIKTOK" },
  shop_id: { type: String, default: null, unique: true },
  shop_code: { type: String, default: "" },
  shop_name: { type: String, default: null, unique: true },
  authorization_code: { type: String, default: "" },
  access_token: { type: String, default: "" },
  refresh_token: { type: String, default: "" },
  cipher: { type: String, default: "" },
  status: { type: String },
  appKey: { type: String, default: "" },
  appSecret: { type: String, default: "" },
  shareLink: { type: String, default: "" },
});

const shop = mongoose.model("Shop", shopSchema);
module.exports = { shop };
