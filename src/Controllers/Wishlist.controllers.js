const Wishlist = require("../Models/Wishlist.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Helper to get user ID from request (token or body/query)
const getUserId = (req) => {
  const userId = req.user?._id || req.body.userId || req.query.userId || req.params.userId;
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }
  return userId;
};

// Get user's wishlist
const getWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    let wishlist = await Wishlist.findOne({ user: userId }).populate("products");

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    res.status(200).json(new ApiResponse(200, wishlist, "Wishlist fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Add product to wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId } = req.body;

    if (!productId) {
      throw new ApiError(400, "Product ID is required");
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    // Check if product already exists in wishlist
    const alreadyExists = wishlist.products.some(
      (id) => id.toString() === productId.toString()
    );

    if (alreadyExists) {
      throw new ApiError(400, "Product already in wishlist");
    }

    wishlist.products.push(productId);
    await wishlist.save();

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate("products");
    res.status(200).json(new ApiResponse(200, populatedWishlist, "Product added to wishlist successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const productId = req.params.productId || req.body.productId;

    if (!productId) {
      throw new ApiError(400, "Product ID is required");
    }

    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      throw new ApiError(404, "Wishlist not found");
    }

    const productIndex = wishlist.products.findIndex(
      (id) => id.toString() === productId.toString()
    );

    if (productIndex === -1) {
      throw new ApiError(404, "Product not found in wishlist");
    }

    wishlist.products.splice(productIndex, 1);
    await wishlist.save();

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate("products");
    res.status(200).json(new ApiResponse(200, populatedWishlist, "Product removed from wishlist successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Toggle product in wishlist (add if not present, remove if present)
const toggleWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId } = req.body;

    if (!productId) {
      throw new ApiError(400, "Product ID is required");
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    const productIndex = wishlist.products.findIndex(
      (id) => id.toString() === productId.toString()
    );

    let message;
    if (productIndex > -1) {
      // Remove if already in wishlist
      wishlist.products.splice(productIndex, 1);
      message = "Product removed from wishlist";
    } else {
      // Add if not in wishlist
      wishlist.products.push(productId);
      message = "Product added to wishlist";
    }

    await wishlist.save();

    const populatedWishlist = await Wishlist.findById(wishlist._id).populate("products");
    res.status(200).json(new ApiResponse(200, populatedWishlist, message));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Clear wishlist
const clearWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const wishlist = await Wishlist.findOne({ user: userId });

    if (wishlist) {
      wishlist.products = [];
      await wishlist.save();
    }

    res.status(200).json(new ApiResponse(200, wishlist, "Wishlist cleared successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
};
