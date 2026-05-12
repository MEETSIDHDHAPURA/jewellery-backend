const Navigation = require("../Models/Navigation.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Update or Create Navigation for a Category
const updateNavigation = async (req, res) => {
  try {
    const { categoryId, styles, shapes, metals, priceRanges } = req.body;

    if (!categoryId) throw new ApiError(400, "Category ID is required");

    const nav = await Navigation.findOneAndUpdate(
      { category: categoryId },
      {
        styles: styles ? JSON.parse(styles) : [],
        shapes: shapes ? JSON.parse(shapes) : [],
        metals: metals ? JSON.parse(metals) : [],
        priceRanges: priceRanges ? JSON.parse(priceRanges) : [],
      },
      { upsert: true, new: true }
    );

    res.status(200).json(new ApiResponse(200, nav, "Navigation updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Full Header Navigation Tree
const getHeaderNavigation = async (req, res) => {
  try {
    const navTree = await Navigation.find().populate("category");
    res.status(200).json(new ApiResponse(200, navTree, "Navigation tree fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  updateNavigation,
  getHeaderNavigation,
};
