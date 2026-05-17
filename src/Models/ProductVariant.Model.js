const mongoose = require("mongoose");

/**
 * Product Variant Schema
 * Handles specific combinations of metal, purity, and size.
 * Optimized for inventory and dynamic pricing.
 */
const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    metal: {
      type: String,
      required: true,
      enum: ["Yellow Gold", "White Gold", "Rose Gold", "Platinum", "Silver"],
    },
    purity: {
      type: String,
      required: true,
      enum: ["14K", "18K", "22K", "24K", "950", "925"],
    },
    sizeType: {
      type: String,
      required: true,
      enum: ["ring", "bracelet", "chain", "earring", "none"],
      default: "none",
    },
    sizeValue: {
      type: String,
      required: function() { return this.sizeType !== "none"; }
    },
    weight: {
      type: Number, // Gross weight in grams
      required: true,
    },
    basePrice: {
      type: Number, // Cost of metal + basic labor for THIS variant
      required: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexing for faster filtering on the frontend
productVariantSchema.index({ productId: 1, metal: 1, purity: 1, sizeValue: 1 });

module.exports = mongoose.model("ProductVariant", productVariantSchema);
