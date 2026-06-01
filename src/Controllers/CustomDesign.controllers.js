const CustomDesign = require("../Models/CustomDesign.Model");
const { uploadOnCloudinary, deleteFromCloudinary } = require("../Utils/Cloudinary");

// Get all custom design requests
exports.getAllCustomDesigns = async (req, res) => {
  try {
    const { isNew, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (isNew !== undefined) {
      filter.isNew = isNew === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [designs, total] = await Promise.all([
      CustomDesign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CustomDesign.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        designs,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching custom designs:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching custom designs",
    });
  }
};

// Get single custom design by ID
exports.getCustomDesignById = async (req, res) => {
  try {
    const { id } = req.params;
    const design = await CustomDesign.findById(id);

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: design,
    });
  } catch (error) {
    console.error("Error fetching custom design:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create a new custom design request
exports.createCustomDesign = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      jewelryType,
      stylePreference,
      shapeDesign,
      metalType,
      caratSize,
      size,
      budgetRange,
      additionalDetails,
    } = req.body;

    if (!name || !phone || !email || !jewelryType || !stylePreference || !shapeDesign || !metalType || !caratSize) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, email, jewelry type, style preference, shape/design, metal type, and carat size are required",
      });
    }

    // Parse metalType if sent as JSON string
    let parsedMetalType = metalType;
    if (typeof metalType === "string") {
      try {
        parsedMetalType = JSON.parse(metalType);
      } catch {
        parsedMetalType = [metalType];
      }
    }

    let referenceImage = "";
    if (req.file) {
      const uploadRes = await uploadOnCloudinary(req.file.path);
      if (uploadRes) {
        referenceImage = uploadRes.secure_url;
      }
    }

    const newDesign = await CustomDesign.create({
      name,
      phone: typeof phone === "string" ? phone.trim() : "",
      email,
      jewelryType,
      stylePreference,
      shapeDesign,
      metalType: parsedMetalType,
      caratSize,
      size: size || "",
      budgetRange: budgetRange || "",
      additionalDetails: additionalDetails || "",
      referenceImage,
    });

    return res.status(201).json({
      success: true,
      data: newDesign,
    });
  } catch (error) {
    console.error("Error creating custom design:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create custom design request",
    });
  }
};

// Update custom design status/isNew
exports.updateCustomDesignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isNew } = req.body;

    const updateData = {};
    if (isNew !== undefined) {
      updateData.isNew = isNew;
    }

    const design = await CustomDesign.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: "after", runValidators: true }
    );

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: design,
    });
  } catch (error) {
    console.error("Error updating custom design:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update custom design status",
    });
  }
};

// Update custom design (full update)
exports.updateCustomDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await CustomDesign.findById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found",
      });
    }

    const updateData = { ...req.body };

    // Parse metalType if sent as JSON string
    if (updateData.metalType && typeof updateData.metalType === "string") {
      try {
        updateData.metalType = JSON.parse(updateData.metalType);
      } catch {
        updateData.metalType = [updateData.metalType];
      }
    }

    // Handle reference image upload
    if (req.file) {
      // Delete old image if exists
      if (existing.referenceImage) {
        await deleteFromCloudinary(existing.referenceImage);
      }
      const uploadRes = await uploadOnCloudinary(req.file.path);
      if (uploadRes) {
        updateData.referenceImage = uploadRes.secure_url;
      }
    }

    const updatedDesign = await CustomDesign.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      data: updatedDesign,
    });
  } catch (error) {
    console.error("Error updating custom design:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update custom design",
    });
  }
};

// Delete custom design
exports.deleteCustomDesign = async (req, res) => {
  try {
    const { id } = req.params;
    const design = await CustomDesign.findById(id);

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Custom design request not found",
      });
    }

    // Delete reference image from cloudinary if exists
    if (design.referenceImage) {
      await deleteFromCloudinary(design.referenceImage);
    }

    await CustomDesign.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Custom design request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting custom design:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete custom design",
    });
  }
};
