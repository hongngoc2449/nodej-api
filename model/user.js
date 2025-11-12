const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, default: "" },
  password: { type: String, default: "" },
  kind: { type: String, default: "user" },
  platform: { type: String, default: "" },
  list_shop: { type: [String], default: [] },
  googleId: { type: String, default: null, sparse: true },
  email: { type: String, default: "" },
  authMethod: { type: String, enum: ["local", "google"], default: "local" },
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
