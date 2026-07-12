const axios = require("axios");
const MetalRate = require("../Models/MetalRate.Model");
const { recalculateAndSavePrices } = require("../Utils/Product.utils");

const syncMetalRates = async () => {
  try {
    const apiKey = process.env.GOLDAPI_KEY;
    if (!apiKey) {
      console.warn("GoldAPI token missing (GOLDAPI_KEY), skipping scheduled metal rates sync.");
      return;
    }

    const headers = { "x-access-token": apiKey };

    console.log("Fetching live rates from GoldAPI.io...");

    // 1. Fetch Gold Rates (XAU) in USD
    const goldRes = await axios.get("https://www.goldapi.io/api/XAU/USD", { headers });
    const gold = goldRes.data;

    // 2. Fetch Silver Rates (XAG) in USD
    const silverRes = await axios.get("https://www.goldapi.io/api/XAG/USD", { headers });
    const silver = silverRes.data;

    // 3. Fetch Platinum Rates (XPT) in USD
    const platRes = await axios.get("https://www.goldapi.io/api/XPT/USD", { headers });
    const plat = platRes.data;

    // Validate responses
    if (!gold || !gold.price_gram_24k || !silver || !silver.price || !plat || !plat.price) {
      throw new Error("Invalid or incomplete rate data received from GoldAPI");
    }

    const silver10g = ((silver.price / 31.1034768) * 0.925) * 10;
    const plat10g = ((plat.price / 31.1034768) * 0.95) * 10;

    const goldPurities = [
      { purity: "24K", base: gold.price_gram_24k },
      { purity: "22K", base: gold.price_gram_22k },
      { purity: "18K", base: gold.price_gram_18k },
      { purity: "14K", base: gold.price_gram_14k },
      { purity: "10K", base: gold.price_gram_10k }
    ];

    const bulkOps = [];

    // Map and calculate gold colors (Calculated based on 10g rate first):
    // - Yellow Gold: base 10g price (X)
    // - White Gold: 10g price + 12% (X * 1.12)
    // - Rose Gold: 10g price - 2% (X * 0.98)
    // Then derive single-gram prices (10g price / 10)
    for (const gp of goldPurities) {
      const yellow10g = gp.base * 10;
      const white10g = yellow10g * 1.12;
      const rose10g = yellow10g * 0.98;

      // Yellow Gold
      bulkOps.push({
        updateOne: {
          filter: { metal: "Yellow Gold", purity: gp.purity },
          update: {
            pricePer10Gram: Number(yellow10g.toFixed(4)),
            pricePerGram: Number((yellow10g / 10).toFixed(4))
          },
          upsert: true
        }
      });

      // White Gold
      bulkOps.push({
        updateOne: {
          filter: { metal: "White Gold", purity: gp.purity },
          update: {
            pricePer10Gram: Number(white10g.toFixed(4)),
            pricePerGram: Number((white10g / 10).toFixed(4))
          },
          upsert: true
        }
      });

      // Rose Gold
      bulkOps.push({
        updateOne: {
          filter: { metal: "Rose Gold", purity: gp.purity },
          update: {
            pricePer10Gram: Number(rose10g.toFixed(4)),
            pricePerGram: Number((rose10g / 10).toFixed(4))
          },
          upsert: true
        }
      });
    }

    // Add Silver 925
    bulkOps.push({
      updateOne: {
        filter: { metal: "Silver", purity: "925" },
        update: {
          pricePer10Gram: Number(silver10g.toFixed(4)),
          pricePerGram: Number((silver10g / 10).toFixed(4))
        },
        upsert: true
      }
    });

    // Add Platinum PT950
    bulkOps.push({
      updateOne: {
        filter: { metal: "Platinum", purity: "PT950" },
        update: {
          pricePer10Gram: Number(plat10g.toFixed(4)),
          pricePerGram: Number((plat10g / 10).toFixed(4))
        },
        upsert: true
      }
    });

    // Execute bulk update
    await MetalRate.bulkWrite(bulkOps);
    console.log("Metal rates updated in DB (Yellow: base, White: +12%, Rose: -2%, Silver 925, Platinum PT950)");

    // Trigger pricing engine recalculations
    const affectedMetals = ["Yellow Gold", "White Gold", "Rose Gold", "Silver", "Platinum"];
    await recalculateAndSavePrices(affectedMetals);
    console.log("Product catalog prices recalculated successfully.");

  } catch (error) {
    console.error("Failed to sync live metal rates:", error.message);
  }
};

module.exports = syncMetalRates;
