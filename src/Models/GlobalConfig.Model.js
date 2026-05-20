const mongoose = require("mongoose");

const globalConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

const GlobalConfig = mongoose.model("GlobalConfig", globalConfigSchema);
module.exports = GlobalConfig;
