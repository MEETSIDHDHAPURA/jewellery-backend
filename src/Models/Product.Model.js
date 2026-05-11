const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String, // Rich text content
            required: true
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
        },
        Price: {
            type: Number,
            required: true
        },
        discountedPrice: {
            type: Number,
            required: true
        },
        discountPercentage: {
            type: Number,
            required: true
        },
        images: {
            type: [String]
        },
        variants: [
            {
                metal: String,
                stoneQuality: String,
                priceModifier: { type: Number, default: 0 },
                stock: { type: Number, default: 0 }
            }
        ],
        specifications: {
            weight: String,
            purity: String,
            dimensions: String,
            stoneDetails: String
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
