const mongoose = require("mongoose");

const LandingPageSchema = new mongoose.Schema(
  {
    section_key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    display_order: {
      type: Number,
      default: 0,
    },
    display_mode: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LandingPage", LandingPageSchema);

