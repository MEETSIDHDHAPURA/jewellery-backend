const Coupon = require("../Models/Coupon.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Coupon
const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minOrderAmount, expiryDate, usageLimit } = req.body;

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) throw new ApiError(409, "Coupon code already exists");

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minOrderAmount,
      expiryDate,
      usageLimit,
    });

    res.status(201).json(new ApiResponse(201, coupon, "Coupon created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Validate Coupon
const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) throw new ApiError(404, "Invalid coupon code");

    if (new Date() > coupon.expiryDate) {
      throw new ApiError(400, "Coupon has expired");
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      throw new ApiError(400, "Coupon usage limit reached");
    }

    if (orderAmount < coupon.minOrderAmount) {
      throw new ApiError(400, `Minimum order amount of ${coupon.minOrderAmount} required`);
    }

    res.status(200).json(new ApiResponse(200, coupon, "Coupon validated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Coupons
const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, coupons, "Coupons fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createCoupon,
  validateCoupon,
  getAllCoupons,
};
