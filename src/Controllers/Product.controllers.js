const Product = require("../Models/Product.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const fs = require("fs");

// Create Product
const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      Price,
      discountedPrice,
      discountPercentage,
      variants,
      specifications,
      occasion,
      isFeatured,
      isActive,
      sizeChart, // Optional: if passed as a string/URL
    } = req.body;

    let images = [];
    let sizeChartPath = sizeChart || "";

    if (req.files) {
      if (req.files.images) {
        images = req.files.images.map((file) => `/uploads/${file.filename}`);
      }
      if (req.files.sizeChart) {
        sizeChartPath = `/uploads/${req.files.sizeChart[0].filename}`;
      }
    }

    // Safely parse JSON strings from FormData
    const parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants || [];
    const parsedSpecs =
      typeof specifications === "string" ? JSON.parse(specifications) : specifications || {};

    let parsedOccasion = [];
    if (occasion) {
      if (typeof occasion === "string") {
        try {
          parsedOccasion = JSON.parse(occasion);
        } catch(e) {
          parsedOccasion = [occasion];
        }
      } else if (Array.isArray(occasion)) {
        parsedOccasion = occasion;
      }
    }

    const product = await Product.create({
      title,
      description,
      category,
      Price,
      discountedPrice,
      discountPercentage,
      images,
      sizeChart: sizeChartPath,
      variants: parsedVariants,
      specifications: parsedSpecs,
      occasion: parsedOccasion,
      isFeatured,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json(new ApiResponse(201, product, "Product created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Products
const getAllProducts = async (req, res) => {
  try {
    const { occasion } = req.query;
    const filter = { isDeleted: false };
    
    if (occasion) {
      const occasionsArray = Array.isArray(occasion) ? occasion : occasion.split(',');
      filter.occasion = { $in: occasionsArray };
    }

    const products = await Product.find(filter)
      .populate("category")
      .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, products, "Products fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Product By Id
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product || product.isDeleted) throw new ApiError(404, "Product not found");
    res.status(200).json(new ApiResponse(200, product, "Product fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

    if (req.files) {
      if (req.files.images && req.files.images.length > 0) {
        updateData.images = req.files.images.map((file) => `/uploads/${file.filename}`);
      }
      if (req.files.sizeChart && req.files.sizeChart.length > 0) {
        updateData.sizeChart = `/uploads/${req.files.sizeChart[0].filename}`;
      }
    }

    // Safely parse JSON strings if they exist
    if (updateData.variants) {
      updateData.variants =
        typeof updateData.variants === "string"
          ? JSON.parse(updateData.variants)
          : updateData.variants;
    }
    if (updateData.specifications) {
      updateData.specifications =
        typeof updateData.specifications === "string"
          ? JSON.parse(updateData.specifications)
          : updateData.specifications;
    }
    if (updateData.occasion) {
      if (typeof updateData.occasion === "string") {
        try {
          updateData.occasion = JSON.parse(updateData.occasion);
        } catch(e) {
          updateData.occasion = [updateData.occasion];
        }
      }
    }

    const product = await Product.findByIdAndUpdate(id, updateData, { new: true });
    if (!product) throw new ApiError(404, "Product not found");

    res.status(200).json(new ApiResponse(200, product, "Product updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Soft Delete Product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );
    if (!product) throw new ApiError(404, "Product not found");
    res.status(200).json(new ApiResponse(200, {}, "Product deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
