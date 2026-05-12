const mongoose = require("mongoose");

const looseDiamondSchema = new mongoose.Schema(
    {
        shape: {
            type: String,
            required: true, // e.g., Round, Princess
            trim: true
        },
        carat: {
            type: Number,
            required: true
        },
        color: {
            type: String,
            required: true // e.g., D, E, F
        },
        clarity: {
            type: String,
            required: true // e.g., VVS1, VS2
        },
        cut: {
            type: String,
            required: true // e.g., Excellent, Very Good
        },
        polish: String,
        symmetry: String,
        fluorescence: String,
        lab: {
            type: String,
            default: "GIA"
        },
        certificateNumber: {
            type: String,
            unique: true
        },
        price: {
            type: Number,
            required: true
        },
        images: [String],
        isAvailable: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("LooseDiamond", looseDiamondSchema);
