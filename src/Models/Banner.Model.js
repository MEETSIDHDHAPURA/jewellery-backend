const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
    },
    media: {
      type: String, // Can store image path OR video path
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
