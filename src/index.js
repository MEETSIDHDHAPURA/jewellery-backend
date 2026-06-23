require("dotenv").config();
const app = require("./app");
const connectDB = require("./Database/Connection");

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Start background worker for welcome coupon email dispatch
    const startDelayedCouponWorker = require("./Utils/delayedCouponWorker");
    startDelayedCouponWorker();

    app.listen(PORT, () => {
      console.log(`Server is running at ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
