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
    countryCode: {
      type: String,
      default: "",
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
    occasion: {
      type: String,
      trim: true,
    },
    stoneType: {
      type: String,
      trim: true,
    },
    timeline: {
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
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

module.exports = mongoose.model("CustomDesign", customDesignSchema);
