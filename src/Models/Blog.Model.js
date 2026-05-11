const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        content: {
            type: String, // Rich text
            required: true
        },
        image: {
            type: String
        },
        author: {
            type: String,
            default: "Admin"
        },
        tags: [String],
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
