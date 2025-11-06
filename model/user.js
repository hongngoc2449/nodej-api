const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, default: "" },
  password: { type: String, default: "" },
  kind: { type: String, default: "user" },
  platform: { type: String, default: "" },
  list_shop: { type: [String], default: [] },
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
