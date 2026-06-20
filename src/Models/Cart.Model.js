const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.Mixed,
    ref: "Product",
    default: null,
  },
  diamond: {
    type: mongoose.Schema.Types.Mixed,
    ref: "DiamondPrice",
    default: null,
  },
  metal: {
    type: String,
  },
  shape: {
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
    freeShipping: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
