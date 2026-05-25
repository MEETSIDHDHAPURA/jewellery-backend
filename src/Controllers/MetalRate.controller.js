const MetalRate = require("../Models/MetalRate.Model.js");
const { recalculateAndSavePrices } = require("../Utils/Product.utils.js");

// Get all metal rates
exports.getMetalRates = async (req, res) => {
  try {
    const rates = await MetalRate.find().sort({ metal: 1, purity: 1 });
    res.status(200).json({ success: true, data: rates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update or create multiple metal rates at once
exports.updateMetalRates = async (req, res) => {
  try {
    const { rates } = req.body; // Expecting an array of rate objects

    if (!Array.isArray(rates)) {
      return res.status(400).json({ success: false, message: "Invalid data format. Expected an array of rates." });
    }

    const updatedRates = await Promise.all(
      rates.map(async (rate) => {
        return await MetalRate.findOneAndUpdate(
          { metal: rate.metal, purity: rate.purity },
          { 
            pricePerGram: rate.pricePerGram, 
            pricePer10Gram: rate.pricePer10Gram,
            updatedBy: req.user ? req.user._id : undefined
          },
          { returnDocument: "after", upsert: true }
        );
      })
    );

    // Recalculate price of ONLY those products whose metal type is affected
    const updatedMetals = [...new Set(rates.map(r => r.metal))];
    await recalculateAndSavePrices(updatedMetals);

    res.status(200).json({ success: true, message: "Rates updated successfully", data: updatedRates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
