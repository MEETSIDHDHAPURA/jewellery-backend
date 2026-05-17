const mongoose = require("mongoose");

const taxCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0,
  }
});

const taxProvinceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      default: "USA",
      trim: true,
    },
    categories: [taxCategorySchema],
  },
  { timestamps: true }
);

taxProvinceSchema.index({ name: 1, country: 1 }, { unique: true });

module.exports = mongoose.model("TaxProvince", taxProvinceSchema);
