const Product = require("../Models/Product.Model");
const ProductVariant = require("../Models/ProductVariant.Model");
const MetalRate = require("../Models/MetalRate.Model");
const MakingCharge = require("../Models/MakingCharge.Model");
const GlobalConfig = require("../Models/GlobalConfig.Model");
const PricingModifier = require("../Models/PricingModifier.Model");
const Category = require("../Models/Category.Model");
const DiamondPrice = require("../Models/DiamondPrice.Model");
const mongoose = require("mongoose");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { uploadOnCloudinary, updateOnCloudinary } = require("../Utils/Cloudinary");
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
      occasion, gender, isFeatured, isActive, Price, isSoldOut, isNew, isBestDeal,
      basePrice, silverBasePrice, weight,
      weight10K, weight14K, weight18K, weight22K, weightSilver, weightPlatinum,
      allowedMetals, allowedCarats, allowedClarities, allowedColors, allowedSizes,
      metaTitle, metaDescription, keywords, certificate,
      settingType, backingType
    } = req.body;

    let sizeChart = "";
    let certificateFile = "";
    let metalImages = {
      yellowGold: [],
      whiteGold: [],
      roseGold: [],
      silver: [],
      platinum: []
    };

    if (req.files) {
      if (req.files.images_yellowGold) {
        for (const file of req.files.images_yellowGold) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) metalImages.yellowGold.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_whiteGold) {
        for (const file of req.files.images_whiteGold) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) metalImages.whiteGold.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_roseGold) {
        for (const file of req.files.images_roseGold) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) metalImages.roseGold.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_silver) {
        for (const file of req.files.images_silver) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) metalImages.silver.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_platinum) {
        for (const file of req.files.images_platinum) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) metalImages.platinum.push(uploadRes.secure_url);
        }
      }
      if (req.files.sizeChart) {
        const uploadRes = await uploadOnCloudinary(req.files.sizeChart[0].path);
        if (uploadRes) {
          sizeChart = uploadRes.secure_url;
        }
      }
      if (req.files.certificate) {
        const uploadRes = await uploadOnCloudinary(req.files.certificate[0].path);
        if (uploadRes) {
          certificateFile = uploadRes.secure_url;
        }
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
      metalImages,
      sizeChart,
      certificate: certificateFile || certificate,
      diamondOptions: safeParseJSON(diamondOptions, []),
      occasion: safeParseJSON(occasion, []),
      gender: gender || "Women",
      isFeatured: parseBoolean(isFeatured, false),
      isActive: parseBoolean(isActive, true),
      isSoldOut: parseBoolean(isSoldOut, false),
      isNew: parseBoolean(isNew, false),
      isBestDeal: parseBoolean(isBestDeal, false),
      settingType: settingType || "",
      backingType: backingType || "",
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

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        let foundCategory = await Category.findOne({
          name: { $regex: new RegExp(`^${category}$`, "i") }
        });
        if (!foundCategory && category.toLowerCase().endsWith('s')) {
          const singular = category.slice(0, -1);
          foundCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${singular}$`, "i") }
          });
        }
        if (foundCategory) {
          filter.category = foundCategory._id;
        } else {
          filter.category = new mongoose.Types.ObjectId();
        }
      }
    }
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

    const isWithin30 = product.createdAt ? (Date.now() - new Date(product.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
    const mappedProduct = {
      ...product,
      isNew: isWithin30 || product.isNew
    };

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
      product: mappedProduct,
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
    const existing = await Product.findById(id);
    if (!existing) throw new ApiError(404, "Product not found");

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
      "isSoldOut",
      "isNew",
      "isBestDeal"
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

    let finalMetalImages = {
      yellowGold: [],
      whiteGold: [],
      roseGold: [],
      silver: [],
      platinum: []
    };

    if (rawBody.existingMetalImages) {
      const existingMetal = safeParseJSON(rawBody.existingMetalImages, {});
      finalMetalImages.yellowGold = existingMetal.yellowGold || [];
      finalMetalImages.whiteGold = existingMetal.whiteGold || [];
      finalMetalImages.roseGold = existingMetal.roseGold || [];
      finalMetalImages.silver = existingMetal.silver || [];
      finalMetalImages.platinum = existingMetal.platinum || [];
    } else if (existing.metalImages) {
      finalMetalImages.yellowGold = existing.metalImages.yellowGold || [];
      finalMetalImages.whiteGold = existing.metalImages.whiteGold || [];
      finalMetalImages.roseGold = existing.metalImages.roseGold || [];
      finalMetalImages.silver = existing.metalImages.silver || [];
      finalMetalImages.platinum = existing.metalImages.platinum || [];
    }

    if (req.files) {
      if (req.files.images_yellowGold) {
        for (const file of req.files.images_yellowGold) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) finalMetalImages.yellowGold.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_whiteGold) {
        for (const file of req.files.images_whiteGold) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) finalMetalImages.whiteGold.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_roseGold) {
        for (const file of req.files.images_roseGold) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) finalMetalImages.roseGold.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_silver) {
        for (const file of req.files.images_silver) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) finalMetalImages.silver.push(uploadRes.secure_url);
        }
      }
      if (req.files.images_platinum) {
        for (const file of req.files.images_platinum) {
          const uploadRes = await uploadOnCloudinary(file.path);
          if (uploadRes) finalMetalImages.platinum.push(uploadRes.secure_url);
        }
      }
      if (req.files.sizeChart) {
        const uploadRes = await updateOnCloudinary(existing.sizeChart, req.files.sizeChart[0].path);
        if (uploadRes) {
          updateData.sizeChart = uploadRes.secure_url;
        }
      }
      if (req.files.certificate) {
        const uploadRes = await updateOnCloudinary(existing.certificate, req.files.certificate[0].path);
        if (uploadRes) {
          updateData.certificate = uploadRes.secure_url;
        }
      }
    }

    updateData.metalImages = finalMetalImages;

    // Enforce isNew logic: within 30 days of creation, isNew must remain false in the DB to dynamically evaluate as true.
    const isWithin30Days = existing.createdAt ? (Date.now() - new Date(existing.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
    if (isWithin30Days) {
      updateData.isNew = false;
    }

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

/**
 * Bulk Create Products
 */
const bulkCreateProducts = async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      throw new ApiError(400, "Invalid products array");
    }

    const errors = [];
    const validatedProducts = [];
    const categoryCache = {};

    // Helper to safely parse lists
    const formatList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // Fall through
        }
        return val.split(",").map(item => item.trim()).filter(Boolean);
      }
      return [val];
    };

    // Helper to safely parse image lists
    const parseImageUrls = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // Fall through
        }
        return val.split(",").map(u => u.trim()).filter(Boolean);
      }
      return [];
    };

    // 1. Validation & Category Lookup Phase
    for (let i = 0; i < products.length; i++) {
      const pData = products[i];
      const rowNum = i + 1;

      try {
        const { title, description, category } = pData;

        if (!title || !title.trim()) {
          throw new Error(`Row ${rowNum}: Title is required`);
        }
        if (!description || !description.trim()) {
          throw new Error(`Row ${rowNum}: Description is required`);
        }
        if (!category) {
          throw new Error(`Row ${rowNum}: Category is required`);
        }

        // Look up category
        let categoryId = null;
        const cacheKey = String(category).trim().toLowerCase();
        if (categoryCache[cacheKey]) {
          categoryId = categoryCache[cacheKey];
        } else {
          if (mongoose.Types.ObjectId.isValid(category)) {
            const cat = await Category.findById(category);
            if (cat) {
              categoryId = cat._id;
            }
          }

          if (!categoryId) {
            const cat = await Category.findOne({
              name: { $regex: new RegExp(`^${category.trim()}$`, "i") }
            });
            if (cat) {
              categoryId = cat._id;
            }
          }

          if (!categoryId) {
            throw new Error(`Row ${rowNum}: Category '${category}' not found.`);
          }
          categoryCache[cacheKey] = categoryId;
        }

        // Store pre-validated info along with original row data
        validatedProducts.push({
          pData,
          rowNum,
          categoryId
        });
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json(new ApiError(400, "Validation failed", errors));
    }

    // 2. Database Insertion Phase
    const createdProducts = [];

    for (const item of validatedProducts) {
      const { pData, categoryId } = item;
      const {
        title, description, subCategory,
        Price, makingCharge, makingChargeType,
        occasion, gender, isFeatured, isActive, isSoldOut,
        basePrice, silverBasePrice, weight,
        weight10K, weight14K, weight18K, weight22K, weightSilver, weightPlatinum,
        allowedMetals, allowedCarats, allowedClarities, allowedColors, allowedSizes,
        metaTitle, metaDescription, keywords, certificate,
        diamondType, diamondShape,
        metalImages_yellowGold, metalImages_whiteGold, metalImages_roseGold, metalImages_silver, metalImages_platinum
      } = pData;

      // Generate unique slug
      let finalSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      const existingProduct = await Product.findOne({ slug: finalSlug });
      if (existingProduct) {
        finalSlug = `${finalSlug}-${Math.random().toString(36).substring(2, 7)}`;
      }

      const metalsParsed = formatList(allowedMetals);
      const caratsParsed = formatList(allowedCarats);
      const claritiesParsed = formatList(allowedClarities);
      const colorsParsed = formatList(allowedColors);
      const sizesParsed = formatList(allowedSizes);
      const occasionsParsed = formatList(occasion);
      const keywordsParsed = formatList(keywords);

      const metalImages = {
        yellowGold: parseImageUrls(metalImages_yellowGold),
        whiteGold: parseImageUrls(metalImages_whiteGold),
        roseGold: parseImageUrls(metalImages_roseGold),
        silver: parseImageUrls(metalImages_silver),
        platinum: parseImageUrls(metalImages_platinum)
      };

      const productData = {
        title,
        slug: finalSlug,
        description,
        category: categoryId,
        subCategory: subCategory || "",
        makingCharge: parseNumber(makingCharge, 0),
        makingChargeType: makingChargeType || "per_gram",
        metalImages,
        sizeChart: pData.sizeChart || "",
        certificate: certificate || "",
        diamondOptions: [],
        occasion: occasionsParsed,
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
        allowedMetals: metalsParsed,
        allowedCarats: caratsParsed,
        allowedClarities: claritiesParsed,
        allowedColors: colorsParsed,
        allowedSizes: sizesParsed,
        metaTitle: metaTitle || "",
        metaDescription: metaDescription || "",
        keywords: keywordsParsed
      };

      // Populate pricing configurations & diamond options automatically
      const mockBody = {
        diamondType: diamondType || "",
        diamondShape: diamondShape || "",
        allowedCarats: caratsParsed,
        allowedClarities: claritiesParsed,
        allowedColors: colorsParsed
      };
      await populatePricingAndDiamonds(productData, mockBody);

      const product = await Product.create(productData);

      // Generate variant combinations
      if (metalsParsed.length > 0 && caratsParsed.length > 0) {
        const config = {
          metals: metalsParsed,
          purities: caratsParsed,
          sizes: sizesParsed,
          sizeType: sizesParsed.length > 0 ? "standard" : "none",
          baseWeight: productData.weight || 0,
          basePrice: productData.Price || 0
        };
        const variantData = generateVariantCombinations(product._id, title, config);
        const createdVariants = await ProductVariant.insertMany(variantData);
        product.variants = createdVariants.map(v => v._id);
        await product.save();
      }

      createdProducts.push(product);
    }

    res.status(201).json(new ApiResponse(201, createdProducts, `${createdProducts.length} products imported successfully`));
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
  bulkCreateProducts,
};
