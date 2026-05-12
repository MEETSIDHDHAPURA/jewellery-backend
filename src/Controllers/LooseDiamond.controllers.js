const LooseDiamond = require("../Models/LooseDiamond.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Loose Diamond
const createLooseDiamond = async (req, res) => {
    try {
        const diamond = await LooseDiamond.create(req.body);
        res.status(201).json(new ApiResponse(201, diamond, "Loose diamond added successfully"));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
    }
};

// Get All Loose Diamonds (with filtering)
const getAllLooseDiamonds = async (req, res) => {
    try {
        const { shape, minCarat, maxCarat, minPrice, maxPrice } = req.query;
        let query = { isAvailable: true };

        if (shape) query.shape = shape;
        if (minCarat || maxCarat) query.carat = { $gte: minCarat || 0, $lte: maxCarat || 100 };
        if (minPrice || maxPrice) query.price = { $gte: minPrice || 0, $lte: maxPrice || 10000000 };

        const diamonds = await LooseDiamond.find(query).sort({ createdAt: -1 });
        res.status(200).json(new ApiResponse(200, diamonds, "Diamonds fetched successfully"));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
    }
};

module.exports = {
    createLooseDiamond,
    getAllLooseDiamonds
};
