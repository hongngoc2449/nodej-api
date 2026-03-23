const mongoose = require("mongoose");

const etsyShopInfoSchema = new mongoose.Schema(
  {
    shop_id: { type: String, required: true, index: true, unique: true },
    shop_name: { type: String, default: "" },
    icon_url_fullxfull: { type: String, default: "" },
    transaction_sold_count: { type: Number, default: 0 },
    review_count: { type: Number, default: 0 },
    num_favorers: { type: Number, default: 0 },
    listing_active_count: { type: Number, default: 0 },
    delta: {
      transaction_sold_count: { type: Number, default: null },
      review_count: { type: Number, default: null },
      num_favorers: { type: Number, default: null },
    },
    created_timestamp: { type: Number, default: null },
    url: { type: String, default: "" },
    last_fetched_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const EtsyShopInfo = mongoose.model("EtsyShopInfo", etsyShopInfoSchema);

module.exports = { EtsyShopInfo };
