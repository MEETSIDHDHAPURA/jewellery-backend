const Newsletter = require("../Models/Newsletter.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

const subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      throw new ApiError(400, "Email must be a non-empty string");
    }

    const normalizedEmail = email.trim().toLowerCase();

    let subscriber = await Newsletter.findOne({ email: normalizedEmail });
    if (subscriber) {
      if (subscriber.isActive) {
        throw new ApiError(400, "Email is already subscribed");
      }
      subscriber.isActive = true;
      await subscriber.save();
    } else {
      subscriber = await Newsletter.create({ email: normalizedEmail });
    }

    res.status(200).json(new ApiResponse(200, subscriber, "Subscribed successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = { subscribeNewsletter };
