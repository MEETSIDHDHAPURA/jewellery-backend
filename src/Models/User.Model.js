const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },  
    addresses: [
      {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: { type: String, default: "India" },
        isDefault: { type: Boolean, default: false },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
