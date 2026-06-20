const DiamondPrice = require("../Models/DiamondPrice.Model.js");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { uploadOnCloudinary, updateOnCloudinary, deleteFromCloudinary } = require("../Utils/Cloudinary");
const mongoose = require("mongoose");
const fs = require("fs");
const logActivity = require("../Utils/logActivity");

// Helper to escape regex special characters to prevent ReDoS
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Create Diamond Price
const createDiamondPrice = async (req, res) => {
  try {
    const { diamondType, shape, carat, clarity, color, price, stock, isSoldOut } = req.body;

    if (!shape || !carat || !clarity || !color) {
      throw new ApiError(400, "shape, carat, clarity, and color are required");
    }

    let imageUrls = [];
    let certificateUrl = "";

    if (req.files) {
      // Upload images and certificate in parallel
      const uploadPromises = [];
      if (req.files.image) {
        req.files.image.forEach(file => {
          uploadPromises.push(
            uploadOnCloudinary(file.path).then(uploadRes => {
              fs.unlink(file.path, () => {});
              if (uploadRes) imageUrls.push(uploadRes.secure_url);
            })
          );
        });
      }
      if (req.files.certificate) {
        uploadPromises.push(
          uploadOnCloudinary(req.files.certificate[0].path).then(uploadRes => {
            fs.unlink(req.files.certificate[0].path, () => {});
            if (uploadRes) certificateUrl = uploadRes.secure_url;
          })
        );
      }
      if (uploadPromises.length > 0) await Promise.all(uploadPromises);
    }

    const diamond = await DiamondPrice.create({
      diamondType: diamondType || "Lab Grown",
      shape,
      carat,
      clarity,
      color,
      price: price || 0,
      stock: stock || 0,
      isSoldOut: isSoldOut !== undefined ? isSoldOut : false,
      image: imageUrls,
      certificate: certificateUrl,
    });

    await logActivity(req, "Create", `create diamond price: ${diamond.diamondType} ${diamond.shape} ${diamond.carat} Carat ${diamond.clarity} ${diamond.color} - Price: ₹${diamond.price}`);

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

    // Use bulkWrite for single DB round-trip instead of N sequential findOneAndUpdate calls
    const bulkOps = diamonds.map(d => ({
      updateOne: {
        filter: {
          diamondType: d.diamondType || "Lab Grown",
          shape: d.shape,
          carat: d.carat,
          clarity: d.clarity,
          color: d.color,
        },
        update: {
          $set: {
            diamondType: d.diamondType || "Lab Grown",
            shape: d.shape,
            carat: d.carat,
            clarity: d.clarity,
            color: d.color,
            price: d.price || 0,
            stock: d.stock || 0,
            isActive: d.isActive !== undefined ? d.isActive : true,
            isSoldOut: d.isSoldOut !== undefined ? d.isSoldOut : false,
          }
        },
        upsert: true
      }
    }));

    const bulkResult = await DiamondPrice.bulkWrite(bulkOps, { ordered: false });
    const totalProcessed = (bulkResult.modifiedCount || 0) + (bulkResult.upsertedCount || 0);

    await logActivity(req, "Create", `bulk create ${totalProcessed} diamond prices`);

    res.status(200).json(new ApiResponse(200, { count: totalProcessed }, `${totalProcessed} diamond prices saved successfully`));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Diamond Prices
const getDiamondPrices = async (req, res) => {
  try {
    const filter = {};
    if (req.query.diamondType && req.query.diamondType !== "all") filter.diamondType = req.query.diamondType;
    if (req.query.carat) filter.carat = Number(req.query.carat);

    // Support multiple shapes
    const shapeInput = req.query.shapes || req.query.shape;
    if (shapeInput && shapeInput !== "all") {
      const shapeArr = Array.isArray(shapeInput) ? shapeInput : (typeof shapeInput === 'string' ? shapeInput.split(',') : [shapeInput]);
      if (shapeArr.length > 0) {
        filter.shape = { $in: shapeArr };
      }
    }

    // Support multiple clarities
    const clarityInput = req.query.clarities || req.query.clarity;
    if (clarityInput && clarityInput !== "all") {
      const clarityArr = Array.isArray(clarityInput) ? clarityInput : (typeof clarityInput === 'string' ? clarityInput.split(',') : [clarityInput]);
      if (clarityArr.length > 0) {
        filter.clarity = { $in: clarityArr };
      }
    }

    // Support multiple colors
    const colorInput = req.query.colours || req.query.colors || req.query.color;
    if (colorInput && colorInput !== "all") {
      const colorArr = Array.isArray(colorInput) ? colorInput : (typeof colorInput === 'string' ? colorInput.split(',') : [colorInput]);
      if (colorArr.length > 0) {
        filter.color = { $in: colorArr };
      }
    }

    // Support priceBand
    if (req.query.priceBand !== undefined && req.query.priceBand !== null && req.query.priceBand !== '') {
      const idx = Number(req.query.priceBand);
      const bands = [
        { min: 0, max: 130 },
        { min: 130, max: 180 },
        { min: 180, max: 230 },
        { min: 230, max: 290 },
        { min: 290, max: Infinity }
      ];
      const band = bands[idx];
      if (band) {
        filter.price = { $gte: band.min };
        if (band.max !== Infinity) {
          filter.price.$lt = band.max;
        }
      }
    }

    if (req.query.search && req.query.search.trim() !== "") {
      const searchVal = req.query.search.trim();
      // Escape regex to prevent ReDoS attacks
      const escapedSearch = escapeRegex(searchVal);
      const searchRegex = new RegExp(escapedSearch, "i");
      const searchConditions = [
        { diamondType: searchRegex },
        { shape: searchRegex },
        { clarity: searchRegex },
        { color: searchRegex }
      ];
      const searchNum = Number(searchVal);
      if (!isNaN(searchNum)) {
        searchConditions.push({ carat: searchNum });
      }
      filter.$or = searchConditions;
    }

    // Validate & clamp pagination parameters
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    let sortObj = { diamondType: 1, shape: 1, carat: 1, color: 1, clarity: 1 };
    if (req.query.sort === 'price-asc') {
      sortObj = { price: 1 };
    } else if (req.query.sort === 'price-desc') {
      sortObj = { price: -1 };
    } else if (req.query.sort === 'name-asc') {
      sortObj = { shape: 1 };
    }

    // Run filtered query + count and stats queries in parallel (6 DB calls → 2 parallel batches)
    const [filteredResults, statsResults] = await Promise.all([
      // Batch 1: Filtered data + count
      Promise.all([
        DiamondPrice.find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        DiamondPrice.countDocuments(filter)
      ]),
      // Batch 2: Unfiltered stats (all run in parallel)
      Promise.all([
        DiamondPrice.estimatedDocumentCount(),
        DiamondPrice.distinct("shape"),
        DiamondPrice.distinct("color"),
        DiamondPrice.distinct("clarity")
      ])
    ]);

    const [diamonds, total] = filteredResults;
    const [totalEntries, uniqueShapesArray, uniqueColorsArray, uniqueClaritiesArray] = statsResults;
    const pages = Math.ceil(total / limit);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          diamonds,
          pagination: {
            total,
            page,
            limit,
            pages,
          },
          stats: {
            totalEntries,
            uniqueShapes: uniqueShapesArray.length,
            uniqueColors: uniqueColorsArray.length,
            uniqueClarities: uniqueClaritiesArray.length,
          },
        },
        "Diamond prices fetched successfully"
      )
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Diamond Price By ID
const getDiamondPriceById = async (req, res) => {
  try {
    // Validate ObjectId to avoid unnecessary DB call
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid diamond price ID");
    }
    const diamond = await DiamondPrice.findById(req.params.id).lean();
    if (!diamond) {
      throw new ApiError(404, "Diamond price not found");
    }
    res.status(200).json(new ApiResponse(200, diamond, "Diamond price fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Diamond Price By ID
const updateDiamondPrice = async (req, res) => {
  try {
    // Validate ObjectId to avoid unnecessary DB call
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid diamond price ID");
    }

    // Use lean() to get existing details
    const existing = await DiamondPrice.findById(req.params.id).lean();
    if (!existing) {
      throw new ApiError(404, "Diamond price not found");
    }

    const updateData = { ...req.body };

    let existingImages = [];
    if (req.body.existingImages) {
      try {
        existingImages = JSON.parse(req.body.existingImages);
      } catch (e) {
        existingImages = Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages];
      }
    } else if (req.body.existingImages === undefined) {
      existingImages = Array.isArray(existing.image)
        ? existing.image
        : (existing.image ? [existing.image] : []);
    }

    const currentImages = Array.isArray(existing.image)
      ? existing.image
      : (existing.image ? [existing.image] : []);

    // Delete removed images from Cloudinary
    const deletedImages = currentImages.filter(img => !existingImages.includes(img));
    if (deletedImages.length > 0) {
      await Promise.all(deletedImages.map(img => deleteFromCloudinary(img).catch(err => console.error("Cloudinary delete error:", err))));
    }

    let imageUrls = [...existingImages];

    if (req.files) {
      const uploadPromises = [];
      if (req.files.image) {
        req.files.image.forEach(file => {
          uploadPromises.push(
            uploadOnCloudinary(file.path).then(uploadRes => {
              fs.unlink(file.path, () => {});
              if (uploadRes) imageUrls.push(uploadRes.secure_url);
            })
          );
        });
      }
      if (req.files.certificate) {
        uploadPromises.push(
          updateOnCloudinary(existing.certificate, req.files.certificate[0].path).then(uploadRes => {
            fs.unlink(req.files.certificate[0].path, () => {});
            if (uploadRes) updateData.certificate = uploadRes.secure_url;
          })
        );
      }
      if (uploadPromises.length > 0) await Promise.all(uploadPromises);
    }

    updateData.image = imageUrls;

    const diamond = await DiamondPrice.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    const oldPrice = existing.price;
    const name = `${existing.diamondType || "Lab Grown"} ${existing.shape} ${existing.carat} Carat ${existing.clarity} ${existing.color}`;
    const priceChanged = updateData.price !== undefined && Number(updateData.price) !== Number(oldPrice);
    
    const actionDesc = priceChanged
      ? `Update diamond price for ${name} from ₹${oldPrice} to ₹${diamond.price}`
      : `Update diamond price details for ${name}`;
    await logActivity(req, "Update", actionDesc);

    res.status(200).json(new ApiResponse(200, diamond, "Diamond price updated successfully"));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json(new ApiError(409, "Diamond is already exist"));
    }
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Diamond Price By ID
const deleteDiamondPrice = async (req, res) => {
  try {
    // Validate ObjectId to avoid unnecessary DB call
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid diamond price ID");
    }

    // Single DB call: findByIdAndDelete returns the deleted doc (eliminates extra findById)
    const diamond = await DiamondPrice.findByIdAndDelete(req.params.id).lean();
    if (!diamond) {
      throw new ApiError(404, "Diamond price not found");
    }

    // Delete Cloudinary assets in parallel
    const deletePromises = [];
    if (diamond.image) {
      if (Array.isArray(diamond.image)) {
        diamond.image.forEach(img => {
          if (img) deletePromises.push(deleteFromCloudinary(img));
        });
      } else {
        deletePromises.push(deleteFromCloudinary(diamond.image));
      }
    }
    if (diamond.certificate) deletePromises.push(deleteFromCloudinary(diamond.certificate));
    if (deletePromises.length > 0) await Promise.all(deletePromises);

    await logActivity(req, "Delete", `Delete diamond price of: ${diamond.diamondType || "Lab Grown"} ${diamond.shape} ${diamond.carat} Carat ${diamond.clarity} ${diamond.color}`);

    res.status(200).json(new ApiResponse(200, {}, "Diamond price deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Related Diamonds (10 suggestions with variety)
const getRelatedDiamonds = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid diamond price ID");
    }

    const diamond = await DiamondPrice.findById(req.params.id).lean();
    if (!diamond) {
      throw new ApiError(404, "Diamond not found");
    }

    const excludeId = diamond._id;
    const LIMIT = 10;

    // Strategy: gather candidates from multiple queries in parallel, then deduplicate and pick 10
    const [sameShapeDiffColor, sameShapeDiffCarat, diffShapeSameCarat, diffShapeDiffCarat] = await Promise.all([
      // 1. Same shape, same carat, different color
      DiamondPrice.find({
        _id: { $ne: excludeId },
        shape: diamond.shape,
        carat: diamond.carat,
        color: { $ne: diamond.color },
        isActive: true,
      })
        .limit(4)
        .lean(),

      // 2. Same shape, different carat
      DiamondPrice.find({
        _id: { $ne: excludeId },
        shape: diamond.shape,
        carat: { $ne: diamond.carat },
        isActive: true,
      })
        .limit(4)
        .lean(),

      // 3. Different shape, same carat
      DiamondPrice.find({
        _id: { $ne: excludeId },
        shape: { $ne: diamond.shape },
        carat: diamond.carat,
        isActive: true,
      })
        .limit(4)
        .lean(),

      // 4. Different shape, different carat (broad variety)
      DiamondPrice.find({
        _id: { $ne: excludeId },
        shape: { $ne: diamond.shape },
        carat: { $ne: diamond.carat },
        isActive: true,
      })
        .limit(4)
        .lean(),
    ]);

    // Deduplicate by _id and cap at 10
    const seen = new Set();
    const related = [];

    for (const pool of [sameShapeDiffColor, sameShapeDiffCarat, diffShapeSameCarat, diffShapeDiffCarat]) {
      for (const d of pool) {
        const id = d._id.toString();
        if (!seen.has(id)) {
          seen.add(id);
          related.push(d);
        }
        if (related.length >= LIMIT) break;
      }
      if (related.length >= LIMIT) break;
    }

    res.status(200).json(
      new ApiResponse(200, related, "Related diamonds fetched successfully")
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createDiamondPrice,
  bulkCreateDiamondPrices,
  getDiamondPrices,
  getDiamondPriceById,
  updateDiamondPrice,
  deleteDiamondPrice,
  getRelatedDiamonds,
};
