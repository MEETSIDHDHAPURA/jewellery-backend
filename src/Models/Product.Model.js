const mongoose = require("mongoose");
const diamondOptionSchema = require("./DiamondOption.Schema");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String, // Rich text content
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    // Base prices for quick listing/searching
    Price: {
      type: Number,
      required: true,
    },
    discountedPrice: {
      type: Number,
      required: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    images: {
      type: [String],
    },
    sizeChart: {
      type: String, // URL for Image/PDF
    },
    makingCharge: {
      type: Number,
      required: true,
      default: 0,
    },
    makingChargeType: {
      type: String,
      enum: ["fixed", "per_gram"],
      default: "per_gram",
    },
    gstPercentage: {
      type: Number,
      default: 3, // Standard GST for jewellery in India
    },

    // Scalable Options
    diamondOptions: [diamondOptionSchema],
    
    // Referenced Variants for Inventory/SKU management
    variants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
      },
    ],

    specifications: {
      dimensions: String,
      stoneDetails: String,
      certification: String, // e.g., "SGL", "IGI", "BIS Hallmark"
    },
    
    occasion: {
      type: [String],
      enum: ["Daily Wear", "Wedding", "Party Wear", "Engagement", "Work Wear", "Anniversary"],
      default: [],
    },
    gender: {
      type: String,
      enum: ["Women", "Men", "Unisex", "Kids"],
      default: "Women",
    },

    // SEO & Marketing
    metaTitle: String,
    metaDescription: String,
    keywords: [String],

    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
