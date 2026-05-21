const Product = require("../Models/Product.Model");
const ProductVariant = require("../Models/ProductVariant.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { generateVariantCombinations } = require("../Utils/Product.utils");
const fs = require("fs");

/**
 * Create Product with Variants
 */
const createProduct = async (req, res) => {
  try {
    const {
      title, slug, description, category, makingCharge, makingChargeType,
      gstPercentage, diamondOptions, variantConfig, specifications,
      occasion, gender, isFeatured, isActive, Price, discountedPrice,
      discountPercentage, basePrice, silverBasePrice, weight,
      weight10K, weight14K, weight18K, weightSilver, weightPlatinum
    } = req.body;

    let images = [];
    let sizeChart = "";

    if (req.files) {
      if (req.files.images) {
        images = req.files.images.map((file) => `/uploads/${file.filename}`);
      }
      if (req.files.sizeChart) {
        sizeChart = `/uploads/${req.files.sizeChart[0].filename}`;
      }
    }

    // 1. Create Base Product
    const product = await Product.create({
      title, slug, description, category, makingCharge, makingChargeType,
      gstPercentage, images, sizeChart,
      diamondOptions: typeof diamondOptions === "string" ? JSON.parse(diamondOptions) : diamondOptions,
      specifications: typeof specifications === "string" ? JSON.parse(specifications) : specifications,
      occasion: typeof occasion === "string" ? JSON.parse(occasion) : occasion,
      gender, isFeatured, isActive, Price, discountedPrice, discountPercentage,
      basePrice, silverBasePrice, weight,
      weight10K, weight14K, weight18K, weightSilver, weightPlatinum
    });

    // 2. Generate and Create Variants if config is provided
    if (variantConfig) {
      const config = typeof variantConfig === "string" ? JSON.parse(variantConfig) : variantConfig;
      const variantData = generateVariantCombinations(product._id, title, config);
      
      const createdVariants = await ProductVariant.insertMany(variantData);
      
      // 3. Link variants back to product
      product.variants = createdVariants.map(v => v._id);
      await product.save();
    }

    res.status(201).json(new ApiResponse(201, product, "Product and variants created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Get All Products with Advanced Filtering
 */
const getAllProducts = async (req, res) => {
  try {
    const { 
      category, occasion, gender, metal, purity, minPrice, maxPrice, 
      isFeatured, search, page = 1, limit = 10 
    } = req.query;

    const filter = { isDeleted: false, isActive: true };

    if (category) filter.category = category;
    if (gender) filter.gender = gender;
    if (isFeatured) filter.isFeatured = isFeatured === 'true';
    if (occasion) filter.occasion = { $in: Array.isArray(occasion) ? occasion : [occasion] };
    if (search) filter.title = { $regex: search, $options: "i" };

    // Price Filter (on base listing price)
    if (minPrice || maxPrice) {
      filter.discountedPrice = {};
      if (minPrice) filter.discountedPrice.$gte = Number(minPrice);
      if (maxPrice) filter.discountedPrice.$lte = Number(maxPrice);
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Product.countDocuments(filter);

    res.status(200).json(new ApiResponse(200, {
      products,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    }, "Products fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Get Single Product with Populated Variants and Pricing Metadata
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate({
        path: "variants",
        match: { isActive: true }
      })
      .lean();

    if (!product || product.isDeleted) {
      throw new ApiError(404, "Product not found");
    }

    // Extract available filters from variants for the frontend
    const variants = product.variants || [];
    const filters = {
      metals: [...new Set(variants.map(v => v.metal))],
      purities: [...new Set(variants.map(v => v.purity))],
      sizes: [...new Set(variants.filter(v => v.sizeValue).map(v => v.sizeValue))],
      diamondTypes: [...new Set(product.diamondOptions.map(d => d.diamondType))],
    };

    res.status(200).json(new ApiResponse(200, {
      product,
      availableFilters: filters
    }, "Product fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Update Product and Manage Variants
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle JSON parsing for multipart data
    ["diamondOptions", "specifications", "occasion", "variants"].forEach(key => {
      if (typeof updateData[key] === "string") {
        updateData[key] = JSON.parse(updateData[key]);
      }
    });

    if (req.files) {
      if (req.files.images) {
        updateData.images = req.files.images.map((file) => `/uploads/${file.filename}`);
      }
      if (req.files.sizeChart) {
        updateData.sizeChart = `/uploads/${req.files.sizeChart[0].filename}`;
      }
    }

    const product = await Product.findByIdAndUpdate(id, updateData, { new: true })
      .populate("variants");
      
    if (!product) throw new ApiError(404, "Product not found");

    res.status(200).json(new ApiResponse(200, product, "Product updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Soft Delete
 */
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!product) throw new ApiError(404, "Product not found");
    
    // Also deactivate variants
    await ProductVariant.updateMany({ productId: product._id }, { isActive: false });

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
