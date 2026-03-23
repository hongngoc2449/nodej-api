const mongoose = require("mongoose");

const etsyShopDailySchema = new mongoose.Schema(
  {
    shop_id: { type: String, required: true, index: true },
    date: { type: String, required: true }, // format: YYYY-MM-DD (UTC)
    shop_name: { type: String, default: "" },
    transaction_sold_count: { type: Number, default: 0 },
    review_count: { type: Number, default: 0 },
    num_favorers: { type: Number, default: 0 },
    created_timestamp: { type: Number, default: null },
    url: { type: String, default: "" },
    last_fetched_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

etsyShopDailySchema.index({ shop_id: 1, date: 1 }, { unique: true });

const EtsyShopDaily = mongoose.model("EtsyShopDaily", etsyShopDailySchema);

module.exports = { EtsyShopDaily };
