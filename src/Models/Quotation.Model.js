const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    countryCode: {
      type: String,
      default: "",
    },
    metalType: {
      type: String,
    },
    purity: {
      type: String,
    },
    weight: {
      type: Number,
    },
    priceEstimate: {
      type: Number,
    },
    date: {
      type: String,
    },
    notes: {
      type: String,
    },
    includeProduct: {
      type: Boolean,
      default: false,
    },
    productId: {
      type: String,
    },
    productTitle: {
      type: String,
    },
    productImage: {
      type: String,
    },
    metalPurity: {
      type: String,
    },
    metalColor: {
      type: String,
    },
    ringSize: {
      type: String,
    },
    productCarat: {
      type: String,
    },
    productClarity: {
      type: String,
    },
    productColor: {
      type: String,
    },
    productPrice: {
      type: Number,
    },
    includeDiamond: {
      type: Boolean,
      default: false,
    },
    diamondType: {
      type: String,
    },
    diamondShape: {
      type: String,
    },
    diamondCarat: {
      type: String,
    },
    diamondClarity: {
      type: String,
    },
    diamondColor: {
      type: String,
    },
    diamondPrice: {
      type: Number,
    },

    subTotal: {
      type: Number,
    },
    marginAmount: {
      type: Number,
    },
    gstAmount: {
      type: Number,
    },

    productsList: [mongoose.Schema.Types.Mixed],
    diamondsList: [mongoose.Schema.Types.Mixed],
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ customerName: 1 });

module.exports = mongoose.model("Quotation", quotationSchema);
