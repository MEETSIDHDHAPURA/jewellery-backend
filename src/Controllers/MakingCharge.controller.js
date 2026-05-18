const MakingCharge = require("../Models/MakingCharge.Model.js");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Making Charge
const createMakingCharge = async (req, res) => {
  try {
    const { metal, type, value } = req.body;

    if (!metal) {
      throw new ApiError(400, "Metal is required");
    }

    // Check if configuration already exists for this metal
    const existing = await MakingCharge.findOne({ metal });
    if (existing) {
      throw new ApiError(400, `Making charge already configured for ${metal}`);
    }

    const charge = await MakingCharge.create({
      metal,
      type: type || "per_gram",
      value: value || 0,
      updatedBy: req.user ? req.user._id : undefined,
    });

    res.status(201).json(new ApiResponse(201, charge, "Making charge created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Making Charges
const getMakingCharges = async (req, res) => {
  try {
    const charges = await MakingCharge.find().sort({ metal: 1 });
    res.status(200).json(new ApiResponse(200, charges, "Making charges fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Making Charge By ID
const getMakingChargeById = async (req, res) => {
  try {
    const charge = await MakingCharge.findById(req.params.id);
    if (!charge) {
      throw new ApiError(404, "Making charge not found");
    }
    res.status(200).json(new ApiResponse(200, charge, "Making charge fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Making Charge By ID
const updateMakingCharge = async (req, res) => {
  try {
    const { metal, type, value } = req.body;

    const charge = await MakingCharge.findByIdAndUpdate(
      req.params.id,
      {
        metal,
        type,
        value,
        updatedBy: req.user ? req.user._id : undefined,
      },
      { new: true, runValidators: true }
    );

    if (!charge) {
      throw new ApiError(404, "Making charge not found");
    }

    res.status(200).json(new ApiResponse(200, charge, "Making charge updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Making Charge By ID
const deleteMakingCharge = async (req, res) => {
  try {
    const charge = await MakingCharge.findByIdAndDelete(req.params.id);
    if (!charge) {
      throw new ApiError(404, "Making charge not found");
    }
    res.status(200).json(new ApiResponse(200, {}, "Making charge deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createMakingCharge,
  getMakingCharges,
  getMakingChargeById,
  updateMakingCharge,
  deleteMakingCharge,
};
