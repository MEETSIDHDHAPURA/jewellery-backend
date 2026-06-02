const Navigation = require("../Models/Navigation.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Update or Create Navigation for a Category
const updateNavigation = async (req, res) => {
  try {
    const { categoryId, styles, shapes, metals, priceRanges } = req.body;

    if (!categoryId) throw new ApiError(400, "Category ID is required");

    const parseField = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === "string") {
        try {
          return JSON.parse(field);
        } catch (e) {
          return [];
        }
      }
      return [];
    };

    const nav = await Navigation.findOneAndUpdate(
      { category: categoryId },
      {
        styles: parseField(styles),
        shapes: parseField(shapes),
        metals: parseField(metals),
        priceRanges: parseField(priceRanges),
      },
      { upsert: true, returnDocument: "after" }
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
