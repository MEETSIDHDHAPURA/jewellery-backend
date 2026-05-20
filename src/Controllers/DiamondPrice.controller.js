const DiamondPrice = require("../Models/DiamondPrice.Model.js");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Diamond Price
const createDiamondPrice = async (req, res) => {
  try {
    const { diamondType, shape, carat, clarity, color, price } = req.body;

    if (!shape || !carat || !clarity || !color) {
      throw new ApiError(400, "shape, carat, clarity, and color are required");
    }

    const diamond = await DiamondPrice.create({
      diamondType: diamondType || "Lab Grown",
      shape,
      carat,
      clarity,
      color,
      price: price || 0,
    });

    res.status(201).json(new ApiResponse(201, diamond, "Diamond price created successfully"));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json(new ApiError(409, "A diamond price with this combination already exists"));
    }
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Bulk Create Diamond Prices
const bulkCreateDiamondPrices = async (req, res) => {
  try {
    const { diamonds } = req.body;

    if (!diamonds || !Array.isArray(diamonds) || diamonds.length === 0) {
      throw new ApiError(400, "diamonds array is required");
    }

    const results = [];
    for (const d of diamonds) {
      const diamond = await DiamondPrice.findOneAndUpdate(
        {
          diamondType: d.diamondType || "Lab Grown",
          shape: d.shape,
          carat: d.carat,
          clarity: d.clarity,
          color: d.color,
        },
        {
          diamondType: d.diamondType || "Lab Grown",
          shape: d.shape,
          carat: d.carat,
          clarity: d.clarity,
          color: d.color,
          price: d.price || 0,
          isActive: d.isActive !== undefined ? d.isActive : true,
        },
        { upsert: true, new: true }
      );
      results.push(diamond);
    }

    res.status(200).json(new ApiResponse(200, { count: results.length }, `${results.length} diamond prices saved successfully`));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Diamond Prices
const getDiamondPrices = async (req, res) => {
  try {
    const filter = {};
    if (req.query.diamondType) filter.diamondType = req.query.diamondType;
    if (req.query.shape) filter.shape = req.query.shape;
    if (req.query.carat) filter.carat = Number(req.query.carat);
    if (req.query.clarity) filter.clarity = req.query.clarity;
    if (req.query.color) filter.color = req.query.color;

    const diamonds = await DiamondPrice.find(filter).sort({ diamondType: 1, shape: 1, carat: 1, color: 1, clarity: 1 });
    res.status(200).json(new ApiResponse(200, diamonds, "Diamond prices fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Diamond Price By ID
const updateDiamondPrice = async (req, res) => {
  try {
    const diamond = await DiamondPrice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!diamond) {
      throw new ApiError(404, "Diamond price not found");
    }

    res.status(200).json(new ApiResponse(200, diamond, "Diamond price updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Diamond Price By ID
const deleteDiamondPrice = async (req, res) => {
  try {
    const diamond = await DiamondPrice.findByIdAndDelete(req.params.id);
    if (!diamond) {
      throw new ApiError(404, "Diamond price not found");
    }
    res.status(200).json(new ApiResponse(200, {}, "Diamond price deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createDiamondPrice,
  bulkCreateDiamondPrices,
  getDiamondPrices,
  updateDiamondPrice,
  deleteDiamondPrice,
};
