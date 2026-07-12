const cron = require("node-cron");
const syncMetalRates = require("../scripts/syncMetalRates");

const startMetalRatesCron = () => {
  // Trigger initial synchronization on server startup
  syncMetalRates();

  // Schedule daily synchronization at 1:00 AM EST
  cron.schedule("0 1 * * *", () => {
    console.log("[CRON] Executing daily scheduled metal rates synchronization...");
    syncMetalRates();
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
};

module.exports = {
  startMetalRatesCron
};
