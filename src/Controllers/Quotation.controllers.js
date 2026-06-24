const mongoose = require("mongoose");
const Quotation = require("../Models/Quotation.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Quotation
const createQuotation = async (req, res) => {
  try {
    const {
      id,
      customerName,
      email,
      phone,
      metalType,
      purity,
      weight,
      priceEstimate,
      date,
      notes,
      includeProduct,
      productId,
      productTitle,
      productImage,
      metalPurity,
      metalColor,
      ringSize,
      productCarat,
      productClarity,
      productColor,
      productPrice,
      includeDiamond,
      diamondType,
      diamondShape,
      diamondCarat,
      diamondClarity,
      diamondColor,
      diamondPrice,
      subTotal,
      marginAmount,
      gstAmount,
      productsList,
      diamondsList
    } = req.body;

    if (!customerName || !email) {
      throw new ApiError(400, "Customer name and email are required");
    }

    // Check if duplicate custom ID
    let finalId = id;
    if (finalId) {
      const existing = await Quotation.findOne({ id: finalId }).select("_id").lean();
      if (existing) {
        throw new ApiError(409, `Quotation with ID ${finalId} already exists`);
      }
    } else {
      // Auto generate if not sent
      const count = await Quotation.countDocuments();
      finalId = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
    }

    const quotation = await Quotation.create({
      id: finalId,
      customerName,
      email,
      phone,
      metalType,
      purity,
      weight,
      priceEstimate,
      date: date || new Date().toISOString().split("T")[0],
      notes,
      includeProduct,
      productId,
      productTitle,
      productImage,
      metalPurity,
      metalColor,
      ringSize,
      productCarat,
      productClarity,
      productColor,
      productPrice,
      includeDiamond,
      diamondType,
      diamondShape,
      diamondCarat,
      diamondClarity,
      diamondColor,
      diamondPrice,
      subTotal,
      marginAmount,
      gstAmount,
      productsList,
      diamondsList
    });

    res.status(201).json(new ApiResponse(201, quotation, "Quotation created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Quotations
const getAllQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find().sort({ createdAt: -1 }).lean();
    res.status(200).json(new ApiResponse(200, quotations, "Quotations fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Quotation
const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const quotation = await Quotation.findOneAndDelete({
      $or: [
        { id: id },
        ...(isMongoId ? [{ _id: id }] : [])
      ]
    });
    
    if (!quotation) {
      throw new ApiError(404, "Quotation not found");
    }

    res.status(200).json(new ApiResponse(200, quotation, "Quotation deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Quotation
const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    
    const quotation = await Quotation.findOneAndUpdate(
      {
        $or: [
          { id: id },
          ...(isMongoId ? [{ _id: id }] : [])
        ]
      },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!quotation) {
      throw new ApiError(404, "Quotation not found");
    }

    res.status(200).json(new ApiResponse(200, quotation, "Quotation updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Quotation By ID
const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const quotation = await Quotation.findOne({
      $or: [
        { id: id },
        ...(isMongoId ? [{ _id: id }] : [])
      ]
    }).lean();

    if (!quotation) {
      throw new ApiError(404, "Quotation not found");
    }

    res.status(200).json(new ApiResponse(200, quotation, "Quotation fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createQuotation,
  getAllQuotations,
  deleteQuotation,
  updateQuotation,
  getQuotationById,
};
