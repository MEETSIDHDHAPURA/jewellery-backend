const MakingCharge = require("../Models/MakingCharge.Model.js");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { recalculateAndSavePrices } = require("../Utils/Product.utils.js");
const logActivity = require("../Utils/logActivity");

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

    await recalculateAndSavePrices([metal]);

    await logActivity(req, "Create", `create making charge for ${charge.metal} with type ${charge.type} and value ${charge.value}`);

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

    const existing = await MakingCharge.findById(req.params.id);
    if (!existing) {
      throw new ApiError(404, "Making charge not found");
    }
    const oldValue = existing.value;
    const oldType = existing.type;

    const charge = await MakingCharge.findByIdAndUpdate(
      req.params.id,
      {
        metal,
        type,
        value,
        updatedBy: req.user ? req.user._id : undefined,
      },
      { returnDocument: "after", runValidators: true }
    );

    await recalculateAndSavePrices([charge.metal]);

    await logActivity(req, "Update", `Update making charge of metal ${charge.metal}: value from ${oldValue} (${oldType}) to ${charge.value} (${charge.type})`);

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

    await recalculateAndSavePrices([charge.metal]);

    await logActivity(req, "Delete", `Delete this making charge of metal ${charge.metal}`);

    res.status(200).json(new ApiResponse(200, {}, "Making charge deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ============= MARGIN =============
const GlobalConfig = require("../Models/GlobalConfig.Model.js");

// Get Margin
const getMargin = async (req, res) => {
  try {
    const config = await GlobalConfig.findOne({ key: "margin_percentage" });
    const margin = config ? config.value : 0;
    res.status(200).json(new ApiResponse(200, { margin }, "Margin fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Set Margin
const setMargin = async (req, res) => {
  try {
    const { margin } = req.body;
    if (margin === undefined || margin === null) {
      throw new ApiError(400, "margin is required");
    }

    const oldConfig = await GlobalConfig.findOne({ key: "margin_percentage" });
    const oldMargin = oldConfig ? oldConfig.value : 0;

    const config = await GlobalConfig.findOneAndUpdate(
      { key: "margin_percentage" },
      { key: "margin_percentage", value: Number(margin) },
      { upsert: true, returnDocument: "after" }
    );

    await recalculateAndSavePrices();

    await logActivity(req, "Update", `Update profit margin from ${oldMargin}% to ${config.value}%`);

    res.status(200).json(new ApiResponse(200, { margin: config.value }, "Margin updated successfully"));
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
  getMargin,
  setMargin,
};
