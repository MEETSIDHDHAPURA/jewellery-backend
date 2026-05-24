const Banner = require("../Models/Banner.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Banner
const createBanner = async (req, res) => {
  try {
    const { title, subtitle, link, order, isActive } = req.body;
    let media = undefined;
    let mediaType = "image";

    if (req.file) {
      media = `/uploads/${req.file.filename}`;
      if (req.file.mimetype && req.file.mimetype.startsWith("video/")) {
        mediaType = "video";
      }
    }

    const banner = await Banner.create({
      title,
      subtitle,
      link,
      media,
      mediaType,
      order: order ? Number(order) : 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json(new ApiResponse(201, banner, "Banner created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json(new ApiResponse(200, banners, "Banners fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Banner By ID
const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw new ApiError(404, "Banner not found");
    res.status(200).json(new ApiResponse(200, banner, "Banner fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Banner
const updateBanner = async (req, res) => {
  try {
    const { title, subtitle, link, order, isActive } = req.body;
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw new ApiError(404, "Banner not found");

    let media = banner.media;
    let mediaType = banner.mediaType;

    if (req.file) {
      media = `/uploads/${req.file.filename}`;
      if (req.file.mimetype && req.file.mimetype.startsWith("video/")) {
        mediaType = "video";
      } else {
        mediaType = "image";
      }
    }

    banner.title = title !== undefined ? title : banner.title;
    banner.subtitle = subtitle !== undefined ? subtitle : banner.subtitle;
    banner.link = link !== undefined ? link : banner.link;
    banner.media = media;
    banner.mediaType = mediaType;
    banner.order = order !== undefined ? Number(order) : banner.order;
    banner.isActive = isActive !== undefined ? isActive : banner.isActive;

    await banner.save();

    res.status(200).json(new ApiResponse(200, banner, "Banner updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Banner
const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) throw new ApiError(404, "Banner not found");
    res.status(200).json(new ApiResponse(200, {}, "Banner deleted successfully"));
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
};
