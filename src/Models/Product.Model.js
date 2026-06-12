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
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
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
    subCategory: {
      type: String,
      trim: true,
    },
    Price: {
      type: Number,
      required: true,
    },
    metalImages: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        yellowGold: [],
        whiteGold: [],
        roseGold: [],
        silver: [],
        platinum: []
      }
    },
    sizeChart: {
      type: String, // URL for Image/PDF
    },
    certificate: {
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
    weight22K: {
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
    variants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
      },
    ],
    occasion: {
      type: [String],
      default: [],
    },
    gender: {
      type: String,
      enum: ["Women", "Men", "Unisex", "Kids"],
      default: "Women",
    },
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
    isSoldOut: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    isBestDeal: {
      type: Boolean,
      default: false,
    },
    settingType: {
      type: String,
      trim: true,
    },
    backingType: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

productSchema.pre("save", async function () {
  if (!this.sku) {
    let unique = false;
    let attempts = 0;
    while (!unique && attempts < 10) {
      const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
      const randomLetters = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3-letter code
      const generatedSku = `SKU-${randomNum}${randomLetters}`;

      const existingProduct = await mongoose.models.Product.findOne({ sku: generatedSku });
      if (!existingProduct) {
        this.sku = generatedSku;
        unique = true;
      }
      attempts++;
    }
  }
});

productSchema.index({ isFeatured: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ isNew: 1, isActive: 1, isDeleted: 1, createdAt: -1 });
productSchema.index({ isBestDeal: 1, isActive: 1, isDeleted: 1, createdAt: -1 });
productSchema.index({ occasion: 1, isActive: 1, isDeleted: 1 });
productSchema.index({ isActive: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
