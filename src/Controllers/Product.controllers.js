const Product = require("../Models/Product.Model");
const ProductVariant = require("../Models/ProductVariant.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { generateVariantCombinations } = require("../Utils/Product.utils");
const fs = require("fs");

// Helper to safely parse JSON strings sent via multipart/form-data
const safeParseJSON = (value, fallback = []) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    if (value.startsWith("[") || value.startsWith("{")) {
      return fallback;
    }
    return value ? [value] : fallback;
  }
};

// Helper to safely convert string to number
const parseNumber = (val, defaultVal = 0) => {
  if (val === undefined || val === null || val === "") return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
};

// Helper to safely parse boolean values
const parseBoolean = (val, defaultVal = false) => {
  if (val === undefined || val === null || val === "") return defaultVal;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
  }
  return !!val;
};

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
      weight10K, weight14K, weight18K, weightSilver, weightPlatinum,
      allowedMetals, allowedCarats, allowedClarities, allowedColors, allowedSizes,
      metaTitle, metaDescription, keywords
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

    // Auto-generate unique slug if not provided
    let finalSlug = slug;
    if (!finalSlug && title) {
      finalSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      
      const existingProduct = await Product.findOne({ slug: finalSlug });
      if (existingProduct) {
        finalSlug = `${finalSlug}-${Math.random().toString(36).substring(2, 7)}`;
      }
    } else if (finalSlug) {
      finalSlug = finalSlug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    }

    // 1. Create Base Product
    const product = await Product.create({
      title,
      slug: finalSlug,
      description,
      category,
      makingCharge: parseNumber(makingCharge, 0),
      makingChargeType: makingChargeType || "per_gram",
      gstPercentage: parseNumber(gstPercentage, 3),
      images,
      sizeChart,
      diamondOptions: safeParseJSON(diamondOptions, []),
      specifications: safeParseJSON(specifications, {}),
      occasion: safeParseJSON(occasion, []),
      gender: gender || "Women",
      isFeatured: parseBoolean(isFeatured, false),
      isActive: parseBoolean(isActive, true),
      Price: parseNumber(Price, 0),
      discountedPrice: parseNumber(discountedPrice, 0),
      discountPercentage: parseNumber(discountPercentage, 0),
      basePrice: parseNumber(basePrice, 0),
      silverBasePrice: parseNumber(silverBasePrice, 0),
      weight: parseNumber(weight, 0),
      weight10K: parseNumber(weight10K, 0),
      weight14K: parseNumber(weight14K, 0),
      weight18K: parseNumber(weight18K, 0),
      weightSilver: parseNumber(weightSilver, 0),
      weightPlatinum: parseNumber(weightPlatinum, 0),
      allowedMetals: safeParseJSON(allowedMetals, []),
      allowedCarats: safeParseJSON(allowedCarats, []),
      allowedClarities: safeParseJSON(allowedClarities, []),
      allowedColors: safeParseJSON(allowedColors, []),
      allowedSizes: safeParseJSON(allowedSizes, []),
      metaTitle,
      metaDescription,
      keywords: safeParseJSON(keywords, [])
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
    const rawBody = { ...req.body };
    const updateData = {};

    // 1. Array and Object fields parsing
    const jsonFields = [
      "diamondOptions",
      "specifications",
      "occasion",
      "variants",
      "allowedMetals",
      "allowedCarats",
      "allowedClarities",
      "allowedColors",
      "allowedSizes",
      "keywords"
    ];

    // 2. Number fields parsing
    const numberFields = [
      "Price",
      "discountedPrice",
      "discountPercentage",
      "makingCharge",
      "gstPercentage",
      "basePrice",
      "silverBasePrice",
      "weight",
      "weight10K",
      "weight14K",
      "weight18K",
      "weightSilver",
      "weightPlatinum"
    ];

    // 3. Boolean fields parsing
    const booleanFields = [
      "isFeatured",
      "isActive",
      "isDeleted"
    ];

    // Process all keys in req.body
    Object.keys(rawBody).forEach(key => {
      if (jsonFields.includes(key)) {
        const fallback = key === "specifications" ? {} : [];
        updateData[key] = safeParseJSON(rawBody[key], fallback);
      } else if (numberFields.includes(key)) {
        updateData[key] = parseNumber(rawBody[key], 0);
      } else if (booleanFields.includes(key)) {
        updateData[key] = parseBoolean(rawBody[key], false);
      } else {
        updateData[key] = rawBody[key];
      }
    });

    // Handle slug formatting if updated
    if (updateData.slug) {
      updateData.slug = updateData.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    } else if (updateData.title && updateData.slug === "") {
      let generatedSlug = updateData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      
      const existingProduct = await Product.findOne({ slug: generatedSlug, _id: { $ne: id } });
      if (existingProduct) {
        generatedSlug = `${generatedSlug}-${Math.random().toString(36).substring(2, 7)}`;
      }
      updateData.slug = generatedSlug;
    }

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
