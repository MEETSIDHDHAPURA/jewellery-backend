const mongoose = require("mongoose");

const diamondPriceSchema = new mongoose.Schema(
  {
    diamondType: {
      type: String,
      required: true,
      enum: ["Natural", "Lab Grown"],
      default: "Lab Grown",
    },
    shape: {
      type: String,
      required: true,
      enum: [
        "Round", "Oval", "Cushion", "Princess", "Pear",
        "Radiant", "Emerald", "Marquise", "Heart", "Asscher"
      ],
    },
    carat: {
      type: Number,
      required: true,
    },
    clarity: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate entries
diamondPriceSchema.index(
  { diamondType: 1, shape: 1, carat: 1, clarity: 1, color: 1 },
  { unique: true }
);

const DiamondPrice = mongoose.model("DiamondPrice", diamondPriceSchema);
module.exports = DiamondPrice;
