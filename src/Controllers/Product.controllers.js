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
const { clearLandingPageCache } = require("./LandingPage.controllers");

// Simple In-memory cache for pricing metadata
let globalMetadataCache = null;
let globalMetadataCacheExpiry = 0;
const METADATA_CACHE_TTL = 15 * 1000; // 15 seconds

const categoryModifiersCache = {};

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

// Helper to escape regex special characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to generate SKU: first 2 letters of category + first 2 letters of subCategory + 5 random digits
const generateSKU = async (categoryId, subCategory) => {
  let catPrefix = "XX";
  if (categoryId) {
    const cat = await Category.findById(categoryId).select("name").lean();
    if (cat && cat.name) {
      catPrefix = cat.name.replace(/[^a-zA-Z]/g, "").substring(0, 2).toUpperCase();
    }
  }
  const subCatPrefix = subCategory
    ? subCategory.replace(/[^a-zA-Z]/g, "").substring(0, 2).toUpperCase()
    : "XX";
  
  let unique = false;
  let attempts = 0;
  let sku = "";
  while (!unique && attempts < 10) {
    const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
    sku = `${catPrefix}-${subCatPrefix}-${randomNum}`;
    const exists = await Product.exists({ sku });
    if (!exists) {
      unique = true;
    }
    attempts++;
  }
  return sku;
};

// Helper to upload multiple files in parallel
const uploadFilesParallel = async (files, uploadFn) => {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const uploadRes = await uploadFn(file.path);
        // Clean up temp file after upload
        fs.unlink(file.path, () => {});
        return uploadRes ? uploadRes.secure_url : null;
      } catch {
        fs.unlink(file.path, () => {});
        return null;
      }
    })
  );
  return results.filter(Boolean);
};

const populatePricingAndDiamonds = async (productData, body, productId = null) => {
  // 1. Populate makingCharge, basePrice, and silverBasePrice from MakingCharge collection
  try {
    const allowedMetals = typeof productData.allowedMetals === "string" ? safeParseJSON(productData.allowedMetals, []) : (productData.allowedMetals || []);
    const selectedMetalVal = allowedMetals && allowedMetals[0] ? allowedMetals[0] : "";

    // Determine which metals we need to query
    const metalsToQuery = ["Yellow Gold", "Silver"];
    if (selectedMetalVal) {
      const lowerMetal = selectedMetalVal.toLowerCase();
      let searchMetal = "Yellow Gold";
      if (lowerMetal.includes("silver")) searchMetal = "Silver";
      else if (lowerMetal.includes("platinum")) searchMetal = "Platinum";
      else if (lowerMetal.includes("white")) searchMetal = "White Gold";
      else if (lowerMetal.includes("rose")) searchMetal = "Rose Gold";
      if (!metalsToQuery.includes(searchMetal)) metalsToQuery.push(searchMetal);
    }

    // Single query to fetch all needed making charges at once
    const allCharges = await MakingCharge.find({ metal: { $in: metalsToQuery } }).lean();
    const chargeMap = {};
    for (const charge of allCharges) {
      chargeMap[charge.metal] = charge;
    }

    if (chargeMap["Yellow Gold"]) productData.basePrice = chargeMap["Yellow Gold"].value || 0;
    if (chargeMap["Silver"]) productData.silverBasePrice = chargeMap["Silver"].value || 0;

    if (selectedMetalVal) {
      const lowerMetal = selectedMetalVal.toLowerCase();
      let searchMetal = "Yellow Gold";
      if (lowerMetal.includes("silver")) searchMetal = "Silver";
      else if (lowerMetal.includes("platinum")) searchMetal = "Platinum";
      else if (lowerMetal.includes("white")) searchMetal = "White Gold";
      else if (lowerMetal.includes("rose")) searchMetal = "Rose Gold";

      const primaryCharge = chargeMap[searchMetal];
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
      const existing = await Product.findById(productId).select("diamondOptions title allowedCarats allowedClarities allowedColors").lean();
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

      // Escape regex inputs to prevent ReDoS
      const matchingDiamonds = await DiamondPrice.find({
        diamondType: { $regex: new RegExp(`^${escapeRegex(diamondType)}$`, "i") },
        shape: { $regex: new RegExp(`^${escapeRegex(diamondShape)}$`, "i") },
        carat: { $in: caratNumbers },
        clarity: { $in: allowedClarities },
        color: { $in: allowedColors }
      }).lean();

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
      // Upload all metal images in parallel for faster processing
      const metalUploadMap = {
        images_yellowGold: "yellowGold",
        images_whiteGold: "whiteGold",
        images_roseGold: "roseGold",
        images_silver: "silver",
        images_platinum: "platinum"
      };

      const metalUploadPromises = Object.entries(metalUploadMap)
        .filter(([fileKey]) => req.files[fileKey])
        .map(async ([fileKey, metalKey]) => {
          const urls = await uploadFilesParallel(req.files[fileKey], uploadOnCloudinary);
          metalImages[metalKey] = urls;
        });

      // Upload sizeChart and certificate in parallel with metal images
      const miscUploads = [];
      if (req.files.sizeChart) {
        miscUploads.push(
          uploadOnCloudinary(req.files.sizeChart[0].path).then(uploadRes => {
            fs.unlink(req.files.sizeChart[0].path, () => {});
            if (uploadRes) sizeChart = uploadRes.secure_url;
          })
        );
      }
      if (req.files.certificate) {
        miscUploads.push(
          uploadOnCloudinary(req.files.certificate[0].path).then(uploadRes => {
            fs.unlink(req.files.certificate[0].path, () => {});
            if (uploadRes) certificateFile = uploadRes.secure_url;
          })
        );
      }

      await Promise.all([...metalUploadPromises, ...miscUploads]);
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

    // Generate SKU: category first 2 letters + subCategory first 2 letters + 5 random digits
    productData.sku = await generateSKU(category, subCategory);

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

    clearLandingPageCache();
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

    // Validate & clamp pagination inputs
    const safePage = Math.max(1, Math.floor(Number(page)) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 10));

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

    // Category filter: single DB call with $or for plural/singular match
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = new mongoose.Types.ObjectId(category);
      } else {
        // Escape regex special characters to prevent ReDoS
        const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPatterns = [{ name: { $regex: new RegExp(`^${escaped}$`, "i") } }];
        if (category.toLowerCase().endsWith('s')) {
          const singularEscaped = escaped.slice(0, -1);
          regexPatterns.push({ name: { $regex: new RegExp(`^${singularEscaped}$`, "i") } });
        }
        const foundCategory = await Category.findOne({ $or: regexPatterns }).lean();
        filter.category = foundCategory ? foundCategory._id : new mongoose.Types.ObjectId();
      }
    }

    if (gender) filter.gender = gender;
    if (isFeatured) filter.isFeatured = isFeatured === 'true';
    if (occasion) filter.occasion = { $in: Array.isArray(occasion) ? occasion : [occasion] };

    // Sanitize search input to prevent ReDoS
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escapedSearch, $options: "i" };
    }

    // Price Filter (on base listing price)
    if (minPrice || maxPrice) {
      filter.Price = {};
      if (minPrice) filter.Price.$gte = Number(minPrice);
      if (maxPrice) filter.Price.$lte = Number(maxPrice);
    }

    const skip = (safePage - 1) * safeLimit;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Single aggregation with $facet: get products + total count in one DB round-trip
    const result = await Product.aggregate([
      { $match: filter },
      {
        $addFields: {
          isNew: {
            $or: [
              { $eq: ["$isNew", true] },
              { $gte: ["$createdAt", thirtyDaysAgo] }
            ]
          }
        }
      },
      { $sort: { isNew: -1, createdAt: -1 } },
      {
        $facet: {
          products: [
            { $skip: skip },
            { $limit: safeLimit },
            { $project: { isDeleted: 0 } },
            {
              $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "category",
                pipeline: [{ $project: { name: 1 } }]
              }
            },
            {
              $addFields: {
                category: { $arrayElemAt: ["$category", 0] }
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ]);

    const products = result[0]?.products || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    res.status(200).json(new ApiResponse(200, {
      products,
      pagination: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) }
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
    // Validate ObjectId to avoid unnecessary DB call
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ApiError(400, "Invalid product ID");
    }

    const product = await Product.findById(productId)
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
    const diamondOptions = product.diamondOptions || [];
    const metalSet = new Set();
    const puritySet = new Set();
    const sizeSet = new Set();
    const diamondTypeSet = new Set();
    for (const v of variants) {
      if (v.metal) metalSet.add(v.metal);
      if (v.purity) puritySet.add(v.purity);
      if (v.sizeValue) sizeSet.add(v.sizeValue);
    }
    for (const d of diamondOptions) {
      if (d.diamondType) diamondTypeSet.add(d.diamondType);
    }
    const filters = {
      metals: [...metalSet],
      purities: [...puritySet],
      sizes: [...sizeSet],
      diamondTypes: [...diamondTypeSet],
    };

    // Fetch pricing metadata with in-memory cache
    const now = Date.now();
    let globalMetaPromise;
    if (globalMetadataCache && now < globalMetadataCacheExpiry) {
      globalMetaPromise = Promise.resolve(globalMetadataCache);
    } else {
      globalMetaPromise = Promise.all([
        MetalRate.find({}).lean(),
        MakingCharge.find({}).lean(),
        GlobalConfig.findOne({ key: "margin_percentage" }).lean()
      ]).then(cacheResult => {
        globalMetadataCache = cacheResult;
        globalMetadataCacheExpiry = Date.now() + METADATA_CACHE_TTL;
        return cacheResult;
      });
    }

    const categoryStr = product.category && product.category._id ? product.category._id.toString() : (product.category ? product.category.toString() : "");
    let modifiersPromise;
    if (categoryStr && categoryModifiersCache[categoryStr] && now < categoryModifiersCache[categoryStr].expiry) {
      modifiersPromise = Promise.resolve(categoryModifiersCache[categoryStr].data);
    } else {
      modifiersPromise = PricingModifier.find({ category: product.category, isActive: true }).lean().then(modResult => {
        if (categoryStr) {
          categoryModifiersCache[categoryStr] = {
            data: modResult,
            expiry: Date.now() + METADATA_CACHE_TTL
          };
        }
        return modResult;
      });
    }

    const [[metalRates, makingCharges, marginConfig], pricingModifiers] = await Promise.all([
      globalMetaPromise,
      modifiersPromise
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

    // 1. Array and Object fields parsing (Set for O(1) lookup)
    const jsonFields = new Set([
      "diamondOptions", "occasion", "variants",
      "allowedMetals", "allowedCarats", "allowedClarities",
      "allowedColors", "allowedSizes", "keywords"
    ]);

    // 2. Number fields parsing
    const numberFields = new Set([
      "Price", "makingCharge", "basePrice", "silverBasePrice",
      "weight", "weight10K", "weight14K", "weight18K",
      "weight22K", "weightSilver", "weightPlatinum"
    ]);

    // 3. Boolean fields parsing
    const booleanFields = new Set([
      "isFeatured", "isActive", "isDeleted",
      "isSoldOut", "isNew", "isBestDeal"
    ]);

    // Process all keys in req.body
    for (const key of Object.keys(rawBody)) {
      if (jsonFields.has(key)) {
        updateData[key] = safeParseJSON(rawBody[key], []);
      } else if (numberFields.has(key)) {
        updateData[key] = parseNumber(rawBody[key], 0);
      } else if (booleanFields.has(key)) {
        updateData[key] = parseBoolean(rawBody[key], false);
      } else {
        updateData[key] = rawBody[key];
      }
    }

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
      // Upload all metal images in parallel for faster processing
      const metalUploadMap = {
        images_yellowGold: "yellowGold",
        images_whiteGold: "whiteGold",
        images_roseGold: "roseGold",
        images_silver: "silver",
        images_platinum: "platinum"
      };

      const metalUploadPromises = Object.entries(metalUploadMap)
        .filter(([fileKey]) => req.files[fileKey])
        .map(async ([fileKey, metalKey]) => {
          const urls = await uploadFilesParallel(req.files[fileKey], uploadOnCloudinary);
          finalMetalImages[metalKey].push(...urls);
        });

      // Upload sizeChart and certificate in parallel with metal images
      const miscUploads = [];
      if (req.files.sizeChart) {
        miscUploads.push(
          updateOnCloudinary(existing.sizeChart, req.files.sizeChart[0].path).then(uploadRes => {
            fs.unlink(req.files.sizeChart[0].path, () => {});
            if (uploadRes) updateData.sizeChart = uploadRes.secure_url;
          })
        );
      }
      if (req.files.certificate) {
        miscUploads.push(
          updateOnCloudinary(existing.certificate, req.files.certificate[0].path).then(uploadRes => {
            fs.unlink(req.files.certificate[0].path, () => {});
            if (uploadRes) updateData.certificate = uploadRes.secure_url;
          })
        );
      }

      await Promise.all([...metalUploadPromises, ...miscUploads]);
    }

    updateData.metalImages = finalMetalImages;

    // Enforce isNew logic: within 30 days of creation, isNew must remain false in the DB to dynamically evaluate as true.
    const isWithin30Days = existing.createdAt ? (Date.now() - new Date(existing.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
    if (isWithin30Days) {
      updateData.isNew = false;
    }

    await populatePricingAndDiamonds(updateData, req.body, id);

    // Regenerate SKU if category or subCategory changed, or if product has no SKU
    const categoryChanged = updateData.category && String(updateData.category) !== String(existing.category);
    const subCategoryChanged = updateData.subCategory !== undefined && updateData.subCategory !== existing.subCategory;
    if (categoryChanged || subCategoryChanged || !existing.sku) {
      const skuCategoryId = updateData.category || existing.category;
      const skuSubCategory = updateData.subCategory !== undefined ? updateData.subCategory : existing.subCategory;
      updateData.sku = await generateSKU(skuCategoryId, skuSubCategory);
    }

    const product = await Product.findByIdAndUpdate(id, updateData, { returnDocument: "after" })
      .populate("variants");

    if (!product) throw new ApiError(404, "Product not found");

    clearLandingPageCache();
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
    // Validate ObjectId to avoid unnecessary DB call
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ApiError(400, "Invalid product ID");
    }

    // Soft-delete product and deactivate variants in parallel
    const [product] = await Promise.all([
      Product.findByIdAndUpdate(productId, { isDeleted: true }, { returnDocument: "after" }),
      ProductVariant.updateMany({ productId: new mongoose.Types.ObjectId(productId) }, { isActive: false })
    ]);
    if (!product) throw new ApiError(404, "Product not found");

    clearLandingPageCache();
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
          // Single query: try ObjectId match OR name match together
          const escapedCat = escapeRegex(category.trim());
          const orConditions = [{ name: { $regex: new RegExp(`^${escapedCat}$`, "i") } }];
          if (mongoose.Types.ObjectId.isValid(category)) {
            orConditions.unshift({ _id: new mongoose.Types.ObjectId(category) });
          }
          const cat = await Category.findOne({ $or: orConditions }).lean();
          if (cat) {
            categoryId = cat._id;
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

      // Generate unique slug (use select + lean for faster check)
      let finalSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      const slugExists = await Product.exists({ slug: finalSlug });
      if (slugExists) {
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

    clearLandingPageCache();
    res.status(201).json(new ApiResponse(201, createdProducts, `${createdProducts.length} products imported successfully`));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Get Related Products based on Category, SubCategory, Occasion, and Gender
 */
const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid product ID");
    }

    const product = await Product.findById(id).lean();
    if (!product || product.isDeleted || !product.isActive) {
      throw new ApiError(404, "Product not found");
    }

    const limit = parseInt(req.query.limit) || 10;

    // Fetch products in the same category
    let related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
      isDeleted: false
    })
    .limit(limit * 2)
    .populate("category", "name")
    .lean();

    // If not enough in the same category, get from other categories
    if (related.length < limit) {
      const extra = await Product.find({
        _id: { $ne: product._id },
        category: { $ne: product.category },
        isActive: true,
        isDeleted: false
      })
      .limit(limit - related.length)
      .populate("category", "name")
      .lean();
      related = [...related, ...extra];
    }

    // Score based on similarity
    const scored = related.map(p => {
      let score = 0;
      if (p.subCategory && product.subCategory && p.subCategory.toLowerCase() === product.subCategory.toLowerCase()) {
        score += 5;
      }
      if (p.occasion && product.occasion) {
        const matches = p.occasion.filter(o => product.occasion.includes(o)).length;
        score += matches * 2;
      }
      if (p.gender === product.gender) {
        score += 1;
      }
      return { p, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const finalProducts = scored.slice(0, limit).map(item => item.p);

    res.status(200).json(new ApiResponse(200, finalProducts, "Related products fetched successfully"));
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
  getRelatedProducts,
};

