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

    let imageUrl = "";
    let certificateUrl = "";

    if (req.files) {
      // Upload image and certificate in parallel
      const uploadPromises = [];
      if (req.files.image) {
        uploadPromises.push(
          uploadOnCloudinary(req.files.image[0].path).then(uploadRes => {
            fs.unlink(req.files.image[0].path, () => {});
            if (uploadRes) imageUrl = uploadRes.secure_url;
          })
        );
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
      image: imageUrl,
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
    if (req.query.shape && req.query.shape !== "all") filter.shape = req.query.shape;
    if (req.query.carat) filter.carat = Number(req.query.carat);
    if (req.query.clarity && req.query.clarity !== "all") filter.clarity = req.query.clarity;
    if (req.query.color && req.query.color !== "all") filter.color = req.query.color;

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

    // Run filtered query + count and stats queries in parallel (6 DB calls → 2 parallel batches)
    const [filteredResults, statsResults] = await Promise.all([
      // Batch 1: Filtered data + count
      Promise.all([
        DiamondPrice.find(filter)
          .sort({ diamondType: 1, shape: 1, carat: 1, color: 1, clarity: 1 })
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

    if (req.files) {
      // Upload image and certificate in parallel
      const uploadPromises = [];
      if (req.files.image) {
        uploadPromises.push(
          updateOnCloudinary(existing.image, req.files.image[0].path).then(uploadRes => {
            fs.unlink(req.files.image[0].path, () => {});
            if (uploadRes) updateData.image = uploadRes.secure_url;
          })
        );
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
    if (diamond.image) deletePromises.push(deleteFromCloudinary(diamond.image));
    if (diamond.certificate) deletePromises.push(deleteFromCloudinary(diamond.certificate));
    if (deletePromises.length > 0) await Promise.all(deletePromises);

    await logActivity(req, "Delete", `Delete diamond price of: ${diamond.diamondType || "Lab Grown"} ${diamond.shape} ${diamond.carat} Carat ${diamond.clarity} ${diamond.color}`);

    res.status(200).json(new ApiResponse(200, {}, "Diamond price deleted successfully"));
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
};
