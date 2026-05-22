const mongoose = require("mongoose");

/**
 * Pricing Modifier Model
 * Stores global attribute-level pricing modifiers (multipliers / flat additions).
 * Used for dynamic price calculation instead of pre-generating variant combinations.
 *
 * Formula: Final Price = Base Price × Metal Multiplier × Carat Multiplier × Clarity Multiplier × Color Multiplier + Size Addition
 */
const pricingModifierSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    attributeType: {
      type: String,
      required: true,
      enum: ["metal", "carat", "color", "clarity", "size"],
      index: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    modifierType: {
      type: String,
      required: true,
      enum: ["multiplier", "flat_add"],
      default: "multiplier",
    },
    modifierValue: {
      type: Number,
      required: true,
      default: 1,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate entries per category
pricingModifierSchema.index({ category: 1, attributeType: 1, value: 1 }, { unique: true });

module.exports = mongoose.model("PricingModifier", pricingModifierSchema);
