require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  try {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
    console.log(
      `\nMongoDB connected! Host: ${connectionInstance.connection.host}`
    );
    return connectionInstance;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};

module.exports = connectDB;
