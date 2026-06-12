const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    topLine: {
      type: String,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    bgWord: {
      type: String,
      trim: true,
    },
    image: {
      type: String, // Can store image path OR video path
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
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

bannerSchema.index({ isActive: 1, order: 1, createdAt: -1 });

module.exports = mongoose.model("Banner", bannerSchema);
