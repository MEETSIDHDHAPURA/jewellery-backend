const Banner = require("../Models/Banner.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { uploadOnCloudinary, updateOnCloudinary, deleteFromCloudinary } = require("../Utils/Cloudinary");

// Create Banner
const createBanner = async (req, res) => {
  try {
    const { title, isActive, category, topLine, subtitle, bgWord } = req.body;
    let imageUrl = undefined;

    if (req.file) {
      const uploadRes = await uploadOnCloudinary(req.file.path);
      if (uploadRes) {
        imageUrl = uploadRes.secure_url;
      }
    }

    // Auto-increment order: find the highest existing order and add 1
    const lastBanner = await Banner.findOne().sort({ order: -1 });
    const nextOrder = lastBanner ? lastBanner.order + 1 : 1;

    const banner = await Banner.create({
      title,
      image: imageUrl,
      order: nextOrder,
      isActive: isActive !== undefined ? isActive : true,
      category: category || undefined,
      topLine,
      subtitle,
      bgWord,
    });

    res.status(201).json(new ApiResponse(201, banner, "Banner created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().populate("category").sort({ order: 1, createdAt: -1 });
    res.status(200).json(new ApiResponse(200, banners, "Banners fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Banner By ID
const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id).populate("category");
    if (!banner) throw new ApiError(404, "Banner not found");
    res.status(200).json(new ApiResponse(200, banner, "Banner fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Banner
const updateBanner = async (req, res) => {
  try {
    const { title, order, isActive, category, topLine, subtitle, bgWord } = req.body;
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw new ApiError(404, "Banner not found");

    if (req.file) {
      const uploadRes = await updateOnCloudinary(banner.image, req.file.path);
      if (uploadRes) {
        banner.image = uploadRes.secure_url;
      }
    }

    banner.title = title !== undefined ? title : banner.title;
    banner.order = order !== undefined ? Number(order) : banner.order;
    banner.isActive = isActive !== undefined ? isActive : banner.isActive;
    banner.topLine = topLine !== undefined ? topLine : banner.topLine;
    banner.subtitle = subtitle !== undefined ? subtitle : banner.subtitle;
    banner.bgWord = bgWord !== undefined ? bgWord : banner.bgWord;
    if (category !== undefined) {
      banner.category = category || null;
    }

    await banner.save();

    res.status(200).json(new ApiResponse(200, banner, "Banner updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Banner
const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw new ApiError(404, "Banner not found");

    // Clean up image from Cloudinary
    if (banner.image) {
      await deleteFromCloudinary(banner.image);
    }

    await Banner.findByIdAndDelete(req.params.id);
    res.status(200).json(new ApiResponse(200, {}, "Banner deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Reorder Banners
const reorderBanners = async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new ApiError(400, "orderedIds array is required");
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } },
      },
    }));

    await Banner.bulkWrite(bulkOps);

    const banners = await Banner.find().populate("category").sort({ order: 1, createdAt: -1 });
    res.status(200).json(new ApiResponse(200, banners, "Banners reordered successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
  reorderBanners,
};
