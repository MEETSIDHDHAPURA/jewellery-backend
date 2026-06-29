const cron = require("node-cron");
const GlobalConfig = require("../Models/GlobalConfig.Model.js");
const MakingChargeController = require("../Controllers/MakingCharge.controller.js");

const fetchAndSaveCurrencyRates = async () => {
  try {
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_KEY}/latest/USD`);
    const data = await response.json();

    if (data && data.result === "success" && data.conversion_rates) {
      const INR = data.conversion_rates.INR;
      const CAD = data.conversion_rates.CAD;

      if (INR && CAD) {
        const config = await GlobalConfig.findOneAndUpdate(
          { key: "currency_rates" },
          { key: "currency_rates", value: { INR: Number(INR), CAD: Number(CAD) } },
          { upsert: true, returnDocument: "after" }
        );

        // Update memory cache in MakingCharge controller
        MakingChargeController.updateCachedRates(config.value);

        console.log(`[CRON] Successfully updated currency rates. INR: ${INR}, CAD: ${CAD}`);
      }
    } else {
      console.error("[CRON] Failed to fetch rates: invalid API response structure");
    }
  } catch (error) {
    console.error("[CRON] Error in currency rates cron job:", error.message);
  }
};

const startCurrencyCron = () => {
  fetchAndSaveCurrencyRates();
  cron.schedule('0 2 * * *', () => {
    fetchAndSaveCurrencyRates();
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
};

module.exports = {
  startCurrencyCron,
  fetchAndSaveCurrencyRates,
};
