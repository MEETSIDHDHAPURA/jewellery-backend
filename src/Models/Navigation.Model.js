const mongoose = require("mongoose");

const navigationSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      unique: true,
    },
    styles: [
      {
        name: String,
        icon: String,
      },
    ],
    shapes: [
      {
        name: String,
        icon: String,
      },
    ],
    metals: [
      {
        name: String,
        color: String,
      },
    ],
    priceRanges: [
      {
        label: String,
        min: Number,
        max: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Navigation", navigationSchema);
