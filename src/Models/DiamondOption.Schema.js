const mongoose = require("mongoose");

/**
 * Reusable Diamond Option Schema
 * Defines the quality and pricing for diamonds used in a product.
 */
const diamondOptionSchema = new mongoose.Schema({
  diamondType: {
    type: String,
    enum: ["Natural", "Lab Grown"],
    required: true,
  },
  carat: { type: String, required: true }, // e.g., "1ct", "0.5ct"
  clarity: { type: String, required: true }, // e.g., "VVS1", "SI1"
  color: { type: String, required: true }, // e.g., "D", "G"
  additionalPrice: { type: Number, default: 0 }, // Price to add for this diamond quality
  isActive: { type: Boolean, default: true }
});

module.exports = diamondOptionSchema;
