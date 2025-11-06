const mongoose = require("mongoose");

const PatternImageSchema = new mongoose.Schema(
  {
    char: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const PatternSetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    source: {
      type: String,
      enum: ["uploaded", "builtin"],
      default: "uploaded",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdByUsername: { type: String, default: "" },
    images: { type: [PatternImageSchema], default: [] },
  },
  { timestamps: true }
);

const PatternSet = mongoose.model("PatternSet", PatternSetSchema);

module.exports = { PatternSetSchema, PatternSet };
