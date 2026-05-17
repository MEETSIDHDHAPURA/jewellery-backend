const mongoose = require("mongoose");

const metalRateSchema = new mongoose.Schema(
  {
    metal: {
      type: String,
      required: true,
      enum: ["Yellow Gold", "White Gold", "Rose Gold", "Platinum", "Silver"],
    },
    purity: {
      type: String,
      required: true,
      enum: ["10K", "14K", "18K", "20K", "22K", "24K", "925", "PT950"],
    },
    pricePerGram: {
      type: Number,
      required: true,
      default: 0,
    },
    pricePer10Gram: {
      type: Number,
      required: true,
      default: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const MetalRate = mongoose.model("MetalRate", metalRateSchema);
module.exports = MetalRate;
