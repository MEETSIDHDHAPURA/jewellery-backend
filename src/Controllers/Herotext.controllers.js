const HeroText = require("../Models/Herotext.Modal");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create HeroText
const createHeroText = async (req, res) => {
  try {
    const { herotext } = req.body;

    if (!herotext || typeof herotext !== "string" || !herotext.trim()) {
      throw new ApiError(400, "herotext must be a non-empty string");
    }

    const newHeroText = await HeroText.create({ herotext });
    res.status(201).json(new ApiResponse(201, newHeroText, "HeroText created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All HeroTexts
const getAllHeroTexts = async (req, res) => {
  try {
    const heroTexts = await HeroText.find();
    res.status(200).json(new ApiResponse(200, heroTexts, "HeroTexts fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get HeroText by ID
const getHeroTextById = async (req, res) => {
  try {
    const { id } = req.params;
    const heroText = await HeroText.findById(id);

    if (!heroText) {
      throw new ApiError(404, "HeroText not found");
    }

    res.status(200).json(new ApiResponse(200, heroText, "HeroText fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update HeroText
const updateHeroText = async (req, res) => {
  try {
    const { id } = req.params;
    const { herotext } = req.body;

    if (!herotext || typeof herotext !== "string" || !herotext.trim()) {
      throw new ApiError(400, "herotext must be a non-empty string");
    }

    const heroText = await HeroText.findByIdAndUpdate(
      id,
      { herotext },
      { new: true, runValidators: true }
    );

    if (!heroText) {
      throw new ApiError(404, "HeroText not found");
    }

    res.status(200).json(new ApiResponse(200, heroText, "HeroText updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete HeroText
const deleteHeroText = async (req, res) => {
  try {
    const { id } = req.params;
    const heroText = await HeroText.findByIdAndDelete(id);

    if (!heroText) {
      throw new ApiError(404, "HeroText not found");
    }

    res.status(200).json(new ApiResponse(200, {}, "HeroText deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createHeroText,
  getAllHeroTexts,
  getHeroTextById,
  updateHeroText,
  deleteHeroText,
};
