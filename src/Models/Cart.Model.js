const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  diamond: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DiamondPrice",
  },
  metal: {
    type: String,
  },
  carat: {
    type: String,
  },
  clarity: {
    type: String,
  },
  color: {
    type: String,
  },
  size: {
    type: String,
  },
  diamondType: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  price: {
    type: Number,
    required: true,
  },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    couponCode: {
      type: String,
      default: null,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["Percentage", "Fixed", null],
      default: null,
    },
    discountValue: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
