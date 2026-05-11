const Product = require("../Models/Product.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const fs = require("fs");
const path = require("path");

// Create Product
const createProduct = async (req, res) => {
    try {
        const { title, description, category, Price, discountedPrice, discountPercentage, variants, specifications, isFeatured } = req.body;

        const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        const product = await Product.create({
            title,
            description,
            category,
            Price,
            discountedPrice,
            discountPercentage,
            images,
            variants: variants ? JSON.parse(variants) : [],
            specifications: specifications ? JSON.parse(specifications) : {},
            isFeatured
        });

        res.status(201).json(new ApiResponse(201, product, "Product created successfully"));
    } catch (error) {
        res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
    }
};

// Get All Products
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({ isDeleted: false }).populate("category").sort({ createdAt: -1 });
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
        const updateData = { ...req.body };

        if (req.files && req.files.length > 0) {
            updateData.images = req.files.map(file => `/uploads/${file.filename}`);
        }

        if (updateData.variants) updateData.variants = JSON.parse(updateData.variants);
        if (updateData.specifications) updateData.specifications = JSON.parse(updateData.specifications);

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
        const product = await Product.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
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
    deleteProduct
};
