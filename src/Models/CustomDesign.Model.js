const mongoose = require("mongoose");

const customDesignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    jewelryType: {
      type: String,
      required: true,
    },
    stylePreference: {
      type: String,
      required: true,
    },
    shapeDesign: {
      type: String,
      required: true,
    },
    metalType: {
      type: [String],
      required: true,
    },
    caratSize: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      trim: true,
    },
    budgetRange: {
      type: String,
      default: "",
    },
    additionalDetails: {
      type: String,
      trim: true,
    },
    referenceImage: {
      type: String,
    },
    isNew: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CustomDesign", customDesignSchema);
