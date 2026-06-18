const mongoose = require("mongoose");

const couponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
    },
    orderTotal: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for fast lookups
couponUsageSchema.index({ coupon: 1, user: 1 });
couponUsageSchema.index({ coupon: 1 });
couponUsageSchema.index({ user: 1 });

module.exports = mongoose.model("CouponUsage", couponUsageSchema);
