const Policy = require("../Models/Policy.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Update or Create Policy
const updatePolicy = async (req, res) => {
  try {
    const { type, content } = req.body;

    if (!type || !content) {
      throw new ApiError(400, "Policy type and content are required");
    }

    const policy = await Policy.findOneAndUpdate(
      { type },
      { content },
      { upsert: true, new: true }
    );

    res.status(200).json(new ApiResponse(200, policy, `${type} updated successfully`));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Single Policy
const getPolicyByType = async (req, res) => {
  try {
    const { type } = req.params;
    const policy = await Policy.findOne({ type });

    if (!policy) {
      throw new ApiError(404, "Policy not found");
    }

    res.status(200).json(new ApiResponse(200, policy, "Policy fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Policies
const getAllPolicies = async (req, res) => {
  try {
    const policies = await Policy.find();
    res.status(200).json(new ApiResponse(200, policies, "All policies fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  updatePolicy,
  getPolicyByType,
  getAllPolicies,
};
