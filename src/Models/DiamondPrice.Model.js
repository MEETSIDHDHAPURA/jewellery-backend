const mongoose = require("mongoose");

const diamondPriceSchema = new mongoose.Schema(
  {
    diamondType: {
      type: String,
      required: true,
      enum: ["Natural", "Lab Grown", "Mojonight"],
      default: "Lab Grown",
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    shape: {
      type: String,
      required: true,
      enum: [
        "Round", "Oval", "Cushion", "Princess", "Pear",
        "Radiant", "Emerald", "Marquise", "Heart", "Asscher"
      ],
    },
    carat: {
      type: Number,
      required: true,
    },
    clarity: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSoldOut: {
      type: Boolean,
      default: false,
    },
    image: {
      type: [String],
    },
    igi: {
      type: String,
    },
    non: {
      type: String,
    },
    gia: {
      type: String,
    },
    cetNumber: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

diamondPriceSchema.pre("save", async function () {
  if (!this.sku) {
    let typePrefix = "LD";
    if (this.diamondType === "Natural") typePrefix = "ND";
    else if (this.diamondType === "Mojonight") typePrefix = "MD";

    let unique = false;
    let attempts = 0;
    while (!unique && attempts < 10) {
      const shapePart = (this.shape || "").toUpperCase();
      const colorPart = (this.color || "").toUpperCase();
      const clarityPart = (this.clarity || "").toUpperCase();
      const randomNum = Math.floor(10000000 + Math.random() * 90000000); // 8-digit random number
      const generatedSku = `${typePrefix}-${shapePart},${colorPart},${clarityPart}-${randomNum}`;

      const existingDoc = await mongoose.models.DiamondPrice.findOne({ sku: generatedSku });
      if (!existingDoc) {
        this.sku = generatedSku;
        unique = true;
      }
      attempts++;
    }
  }
});

const DiamondPrice = mongoose.model("DiamondPrice", diamondPriceSchema);
module.exports = DiamondPrice;
