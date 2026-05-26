const mongoose = require("mongoose");

const diamondPriceSchema = new mongoose.Schema(
  {
    diamondType: {
      type: String,
      required: true,
      enum: ["Natural", "Lab Grown", "Mojonight"],
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
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSoldOut: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
    },
    certificate: {
      type: String,
    },
  },
  { timestamps: true }
);

const DiamondPrice = mongoose.model("DiamondPrice", diamondPriceSchema);
module.exports = DiamondPrice;
