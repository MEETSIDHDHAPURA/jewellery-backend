const mongoose = require("mongoose");

const heroTextSchema = new mongoose.Schema({
    herotext: {
        type: String,
        required: true,
    },
});

const HeroText = mongoose.model("HeroText", heroTextSchema);
module.exports = HeroText;