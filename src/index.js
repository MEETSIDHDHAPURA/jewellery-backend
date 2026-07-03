require("dotenv").config();
const app = require("./app");
const connectDB = require("./Database/Connection");
const { startCurrencyCron } = require("./Utils/CurrencyCron");
const { startPaymentCron } = require("./Utils/paymentCron");

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    startCurrencyCron();
    startPaymentCron();
    


    app.listen(PORT, () => {
      console.log(`Server is running at ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
