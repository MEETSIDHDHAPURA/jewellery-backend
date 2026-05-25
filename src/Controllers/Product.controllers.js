const Product = require("../Models/Product.Model");
const ProductVariant = require("../Models/ProductVariant.Model");
const MetalRate = require("../Models/MetalRate.Model");
const MakingCharge = require("../Models/MakingCharge.Model");
const GlobalConfig = require("../Models/GlobalConfig.Model");
const PricingModifier = require("../Models/PricingModifier.Model");
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

const populatePricingAndDiamonds = async (productData, body, productId = null) => {
  // 1. Populate makingCharge, basePrice, and silverBasePrice from MakingCharge collection
  try {
    const MakingCharge = require("../Models/MakingCharge.Model");
    const goldCharge = await MakingCharge.findOne({ metal: "Yellow Gold" });
    const silverCharge = await MakingCharge.findOne({ metal: "Silver" });

    if (goldCharge) productData.basePrice = goldCharge.value || 0;
    if (silverCharge) productData.silverBasePrice = silverCharge.value || 0;

    const allowedMetals = typeof productData.allowedMetals === "string" ? safeParseJSON(productData.allowedMetals, []) : (productData.allowedMetals || []);
    const selectedMetalVal = allowedMetals && allowedMetals[0] ? allowedMetals[0] : "";
    if (selectedMetalVal) {
      const isSilver = selectedMetalVal.toLowerCase().includes("silver");
      const isPlatinum = selectedMetalVal.toLowerCase().includes("platinum");
      let searchMetal = "Yellow Gold";
      if (isSilver) searchMetal = "Silver";
      else if (isPlatinum) searchMetal = "Platinum";
      else if (selectedMetalVal.toLowerCase().includes("white")) searchMetal = "White Gold";
      else if (selectedMetalVal.toLowerCase().includes("rose")) searchMetal = "Rose Gold";
      else searchMetal = "Yellow Gold";

      const primaryCharge = await MakingCharge.findOne({ metal: searchMetal });
      if (primaryCharge) {
        productData.makingCharge = primaryCharge.value || 0;
        productData.makingChargeType = "per_gram";
      }
    }
  } catch (err) {
    console.error("Error populating making charges:", err);
  }

  // 2. Populate diamondOptions based on allowed attributes and selections
  try {
    let diamondType = body.diamondType;
    let diamondShape = body.diamondShape;
    let allowedCarats = typeof body.allowedCarats === "string" ? safeParseJSON(body.allowedCarats, []) : (body.allowedCarats || []);
    let allowedClarities = typeof body.allowedClarities === "string" ? safeParseJSON(body.allowedClarities, []) : (body.allowedClarities || []);
    let allowedColors = typeof body.allowedColors === "string" ? safeParseJSON(body.allowedColors, []) : (body.allowedColors || []);

    if (productId && (!diamondType || !diamondShape || allowedCarats.length === 0)) {
      const Product = require("../Models/Product.Model");
      const existing = await Product.findById(productId);
      if (existing) {
        if (!diamondType) diamondType = existing.diamondOptions && existing.diamondOptions[0] ? existing.diamondOptions[0].diamondType : "";
        if (!diamondShape) {
          const shapes = ["Round", "Oval", "Cushion", "Princess", "Pear", "Radiant", "Emerald", "Marquise", "Heart", "Asscher"];
          diamondShape = shapes.find(s => existing.title.toLowerCase().includes(s.toLowerCase())) || "Round";
        }
        if (allowedCarats.length === 0) allowedCarats = existing.allowedCarats || [];
        if (allowedClarities.length === 0) allowedClarities = existing.allowedClarities || [];
        if (allowedColors.length === 0) allowedColors = existing.allowedColors || [];
      }
    }

    if (diamondType && diamondShape && allowedCarats.length > 0) {
      const DiamondPrice = require("../Models/DiamondPrice.Model");
      
      const caratNumbers = allowedCarats.map(c => Number(c) || parseFloat(c));

      const matchingDiamonds = await DiamondPrice.find({
        diamondType: { $regex: new RegExp(`^${diamondType}$`, "i") },
        shape: { $regex: new RegExp(`^${diamondShape}$`, "i") },
        carat: { $in: caratNumbers },
        clarity: { $in: allowedClarities },
        color: { $in: allowedColors }
      });

      if (matchingDiamonds && matchingDiamonds.length > 0) {
        productData.diamondOptions = matchingDiamonds.map(d => ({
          diamondType: d.diamondType,
          carat: d.carat.toString(),
          clarity: d.clarity,
          color: d.color,
          additionalPrice: d.price || 0,
          isActive: true
        }));
      }
    }
  } catch (err) {
    console.error("Error populating diamond options:", err);
  }
};

/**
 * Create Product with Variants
 */
const createProduct = async (req, res) => {
  try {
    const {
      title, slug, description, category, subCategory, makingCharge, makingChargeType,
      diamondOptions, variantConfig,
      occasion, gender, isFeatured, isActive, Price, isSoldOut,
      basePrice, silverBasePrice, weight,
      weight10K, weight14K, weight18K, weight22K, weightSilver, weightPlatinum,
      allowedMetals, allowedCarats, allowedClarities, allowedColors, allowedSizes,
      metaTitle, metaDescription, keywords, certificate
    } = req.body;

    let images = [];
    let sizeChart = "";
    let certificateFile = "";

    if (req.files) {
      if (req.files.images) {
        images = req.files.images.map((file) => `/uploads/${file.filename}`);
      }
      if (req.files.sizeChart) {
        sizeChart = `/uploads/${req.files.sizeChart[0].filename}`;
      }
      if (req.files.certificate) {
        certificateFile = `/uploads/${req.files.certificate[0].filename}`;
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
    const productData = {
      title,
      slug: finalSlug,
      description,
      category,
      subCategory,
      makingCharge: parseNumber(makingCharge, 0),
      makingChargeType: makingChargeType || "per_gram",
      images,
      sizeChart,
      certificate: certificateFile || certificate,
      diamondOptions: safeParseJSON(diamondOptions, []),
      occasion: safeParseJSON(occasion, []),
      gender: gender || "Women",
      isFeatured: parseBoolean(isFeatured, false),
      isActive: parseBoolean(isActive, true),
      isSoldOut: parseBoolean(isSoldOut, false),
      Price: parseNumber(Price, 0),
      basePrice: parseNumber(basePrice, 0),
      silverBasePrice: parseNumber(silverBasePrice, 0),
      weight: parseNumber(weight, 0),
      weight10K: parseNumber(weight10K, 0),
      weight14K: parseNumber(weight14K, 0),
      weight18K: parseNumber(weight18K, 0),
      weight22K: parseNumber(weight22K, 0),
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
    };

    await populatePricingAndDiamonds(productData, req.body);

    const product = await Product.create(productData);

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
      isFeatured, search, page = 1, limit = 10, isActive
    } = req.query;

    const filter = { isDeleted: false };
    if (isActive === 'all') {
      // do not filter by isActive
    } else if (isActive === 'false' || isActive === false) {
      filter.isActive = false;
    } else if (isActive === 'true' || isActive === true) {
      filter.isActive = true;
    } else {
      filter.isActive = true;
    }

    if (category) filter.category = category;
    if (gender) filter.gender = gender;
    if (isFeatured) filter.isFeatured = isFeatured === 'true';
    if (occasion) filter.occasion = { $in: Array.isArray(occasion) ? occasion : [occasion] };
    if (search) filter.title = { $regex: search, $options: "i" };

    // Price Filter (on base listing price)
    if (minPrice || maxPrice) {
      filter.Price = {};
      if (minPrice) filter.Price.$gte = Number(minPrice);
      if (maxPrice) filter.Price.$lte = Number(maxPrice);
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .select("-isDeleted")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const latestProducts = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id")
      .lean();
    const latestIds = latestProducts.map(p => p._id.toString());

    const productsWithIsNew = products.map(product => ({
      ...product,
      isNew: latestIds.includes(product._id.toString())
    }));

    const total = await Product.countDocuments(filter);

    res.status(200).json(new ApiResponse(200, {
      products: productsWithIsNew,
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
      .select("-isDeleted")
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

    // Fetch pricing metadata for client-side calculations
    const [metalRates, makingCharges, marginConfig, pricingModifiers] = await Promise.all([
      MetalRate.find({}),
      MakingCharge.find({}),
      GlobalConfig.findOne({ key: "margin_percentage" }),
      PricingModifier.find({ category: product.category, isActive: true })
    ]);

    res.status(200).json(new ApiResponse(200, {
      product,
      availableFilters: filters,
      pricingMetadata: {
        metalRates,
        makingCharges,
        margin: marginConfig ? marginConfig.value : 0,
        pricingModifiers
      }
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
      "makingCharge",
      "basePrice",
      "silverBasePrice",
      "weight",
      "weight10K",
      "weight14K",
      "weight18K",
      "weight22K",
      "weightSilver",
      "weightPlatinum"
    ];

    // 3. Boolean fields parsing
    const booleanFields = [
      "isFeatured",
      "isActive",
      "isDeleted",
      "isSoldOut"
    ];

    // Process all keys in req.body
    Object.keys(rawBody).forEach(key => {
      if (jsonFields.includes(key)) {
        const fallback = [];
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

    let finalImages = [];
    if (rawBody.existingImages) {
      finalImages = safeParseJSON(rawBody.existingImages, []);
    } else {
      const existing = await Product.findById(id);
      if (existing) finalImages = existing.images || [];
    }

    if (req.files) {
      if (req.files.images) {
        const newImages = req.files.images.map((file) => `/uploads/${file.filename}`);
        finalImages = [...finalImages, ...newImages];
      }
      if (req.files.sizeChart) {
        updateData.sizeChart = `/uploads/${req.files.sizeChart[0].filename}`;
      }
      if (req.files.certificate) {
        updateData.certificate = `/uploads/${req.files.certificate[0].filename}`;
      }
    }

    updateData.images = finalImages;

    await populatePricingAndDiamonds(updateData, req.body, id);

    const product = await Product.findByIdAndUpdate(id, updateData, { returnDocument: "after" })
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
    const product = await Product.findByIdAndUpdate(req.params.id, { isDeleted: true }, { returnDocument: "after" });
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
