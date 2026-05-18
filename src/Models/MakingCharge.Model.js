const mongoose = require("mongoose");

const makingChargeSchema = new mongoose.Schema(
  {
    metal: {
      type: String,
      required: true,
      unique: true,
      enum: ["Yellow Gold", "White Gold", "Rose Gold", "Platinum", "Silver"],
    },
    type: {
      type: String,
      required: true,
      enum: ["per_gram", "flat"],
      default: "per_gram",
    },
    value: {
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

const MakingCharge = mongoose.model("MakingCharge", makingChargeSchema);
module.exports = MakingCharge;
