const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, default: "" },
  password: { type: String, default: "" },
  kind: { type: String, default: "user" },
  status: { type: String, enum: ["active", "unactive"], default: "unactive" },
  quota: { type: Number, default: 0, min: 0 },
  apiKey: { type: String, default: null, unique: true, sparse: true },
  apiRequestCount: { type: Number, default: 0, min: 0 },
  dailyApiRequestCount: { type: Number, default: 0, min: 0 },
  apiQuotaDate: { type: String, default: "" },
  apiKeyCreatedAt: { type: Date, default: null },
  lastApiRequestAt: { type: Date, default: null },
  platform: { type: String, default: "" },
  list_shop: { type: [String], default: [] },
  googleId: { type: String, default: null, sparse: true },
  email: { type: String, default: "" },
  authMethod: { type: String, enum: ["local", "google"], default: "local" },
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
