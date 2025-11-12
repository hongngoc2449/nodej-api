const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    platform: { type: String, default: "ETSY" },
    shop_id: { type: String, default: null, unique: true },
    shop_code: { type: String, default: "" },
    shop_name: { type: String, default: null, unique: true },
    authorization_code: { type: String, default: "" },
    access_token: { type: String, default: "" },
    refresh_token: { type: String, default: "" },
    cipher: { type: String, default: "" },
    status: { type: String, default: "active" },
    appKey: { type: String, default: "" },
    appSecret: { type: String, default: "" },
    shareLink: { type: String, default: "" },
    // Thêm các trường mới cho bảng Shop
    accountName: { type: String, default: "" },
    title: { type: String, default: "" },
    listingCount: { type: Number, default: 0 },
    digitalCount: { type: Number, default: 0 },
    useNewEndpoints: { type: Boolean, default: true },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
  },
  { timestamps: true }
);

const shop = mongoose.model("Shop", shopSchema);
module.exports = { shop };
