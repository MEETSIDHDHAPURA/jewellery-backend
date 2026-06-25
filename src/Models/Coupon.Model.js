const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    // ─── Core Fields ───
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    discountType: {
      type: String,
      enum: ["Percentage", "Fixed", "FreeShipping"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number, // Cap for percentage discounts
    },

    // ─── Date Range ───
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },

    // ─── Usage Limits ───
    usageLimit: {
      type: Number,
      default: 100,
    },
    usageLimitPerCustomer: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },

    // ─── Eligibility Rules ───
    eligibility: {
      type: String,
      enum: ["all", "logged_in"],
      default: "all",
    },
    country: {
      type: String,
      default: "all",
    },
    province: {
      type: String,
      default: "",
    },

    // ─── Category Restrictions (empty = all categories) ───
    applicableCategories: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],

    // ─── Diamond Shape Restrictions (empty = all shapes) ───
    applicableShapes: [
      {
        type: String,
      },
    ],

    // ─── Status ───
    isActive: {
      type: Boolean,
      default: true,
    },

    // ─── Image ───
    image: {
      type: String,
      default: "",
    },

    // ─── Email Capture (Popup) ───
    sendOnRegistration: {
      type: Boolean,
      default: false,
    },
    capturedEmails: [
      {
        email: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ expiryDate: 1 });

module.exports = mongoose.model("Coupon", couponSchema);
