const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    loginName: { type: String, required: true },
    primaryEmail: { type: String, required: true },
    useNewEndpoints: { type: Boolean, default: true },
    platform: { type: String, default: "ETSY" },
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    shopId: { type: String, default: "" },
    shopName: { type: String, default: "" },
    status: { type: String, default: "active" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const Account = mongoose.model("Account", accountSchema);

module.exports = { Account };

