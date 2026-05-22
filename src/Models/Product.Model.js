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

    // Scalable Options
    diamondOptions: [diamondOptionSchema],

    // Modifier-Based Pricing: Allowed attributes for this product
    basePrice: {
      type: Number, // Gold Making Cost
      default: 0,
    },
    silverBasePrice: {
      type: Number, // Silver Making Cost
      default: 0,
    },
    weight: {
      type: Number, // Product weight in grams
      default: 0,
    },
    weight10K: {
      type: Number,
      default: 0,
    },
    weight14K: {
      type: Number,
      default: 0,
    },
    weight18K: {
      type: Number,
      default: 0,
    },
    weightSilver: {
      type: Number,
      default: 0,
    },
    weightPlatinum: {
      type: Number,
      default: 0,
    },
    allowedMetals: {
      type: [String],
      default: [],
    },
    allowedCarats: {
      type: [String],
      default: [],
    },
    allowedClarities: {
      type: [String],
      default: [],
    },
    allowedColors: {
      type: [String],
      default: [],
    },
    allowedSizes: {
      type: [String],
      default: [],
    },
    
    // Referenced Variants for Inventory/SKU management (legacy support)
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
      enum: ["engagement", "anniversary", "Bridal", "every day wear", "festival"],
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
