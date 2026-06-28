const mongoose = require("mongoose");
const Wishlist = require("../Models/Wishlist.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Helper to get user ID from request (token or body/query)
const getUserId = (req) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User ID is required / User is not authenticated");
  }
  return userId;
};

// Helper to format/map the wishlist for frontend compatibility
const formatWishlist = (wishlist) => {
  if (!wishlist) return null;
  const wishlistObj = typeof wishlist.toObject === 'function' ? wishlist.toObject() : wishlist;

  if (!wishlistObj.products) wishlistObj.products = [];
  else wishlistObj.products = wishlistObj.products.filter(Boolean);
  if (!wishlistObj.diamonds) wishlistObj.diamonds = [];
  else wishlistObj.diamonds = wishlistObj.diamonds.filter(Boolean);

  if (wishlistObj.diamonds && wishlistObj.diamonds.length > 0) {
    const mappedDiamonds = wishlistObj.diamonds.map(d => {
      if (!d) return null;
      return {
        ...d,
        title: d.carat ? `${d.carat} Carat ${d.color || ""} ${d.clarity || ""} ${d.shape || ""} Cut Diamond` : `${d.shape || ""} Cut Diamond`,
        Price: d.price || 0,
        isSoldOut: d.isSoldOut || false,
        category: { name: "Loose Diamonds" },
        metalImages: {
          yellowGold: Array.isArray(d.image) ? d.image : [d.image || ""]
        }
      };
    }).filter(Boolean);

    wishlistObj.products = [
      ...wishlistObj.products,
      ...mappedDiamonds
    ];
  }

  return wishlistObj;
};

// Sync wishlist items to ensure no deleted or inactive products/diamonds remain
const syncWishlistItems = async (wishlist) => {
  if (!wishlist) return wishlist;

  const needsPopulate = 
    (wishlist.products && wishlist.products.some(p => p && !p.name)) ||
    (wishlist.diamonds && wishlist.diamonds.some(d => d && !d.shape));

  if (needsPopulate) {
    await wishlist.populate("products");
    await wishlist.populate("diamonds");
  }

  let hasChanges = false;

  if (wishlist.products && wishlist.products.length > 0) {
    const activeProducts = wishlist.products.filter(p => {
      if (!p || p.isDeleted || p.isActive === false) {
        hasChanges = true;
        return false;
      }
      return true;
    });
    if (hasChanges) {
      wishlist.products = activeProducts.map(p => p._id);
    }
  }

  if (wishlist.diamonds && wishlist.diamonds.length > 0) {
    const activeDiamonds = wishlist.diamonds.filter(d => {
      if (!d || d.isActive === false) {
        hasChanges = true;
        return false;
      }
      return true;
    });
    if (hasChanges) {
      wishlist.diamonds = activeDiamonds.map(d => d._id);
    }
  }

  if (hasChanges) {
    await wishlist.save();
  }

  return wishlist;
};

// Get user's wishlist
const getWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [], diamonds: [] });
    } else {
      await syncWishlistItems(wishlist);
      // Refetch with populated details
      wishlist = await Wishlist.findById(wishlist._id)
        .populate("products")
        .populate("diamonds");
    }

    res.status(200).json(new ApiResponse(200, formatWishlist(wishlist), "Wishlist fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Add product/diamond to wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId } = req.body;

    if (!productId) {
      throw new ApiError(400, "Product ID is required");
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [], diamonds: [] });
    } else {
      await syncWishlistItems(wishlist);
    }

    if (!wishlist.diamonds) {
      wishlist.diamonds = [];
    }

    const Product = require("../Models/Product.Model");
    const DiamondPrice = require("../Models/DiamondPrice.Model");

    const isDiamond = mongoose.isValidObjectId(productId) && await DiamondPrice.exists({ _id: productId });

    if (isDiamond) {
      const alreadyExists = wishlist.diamonds.some(
        (id) => id && id.toString() === productId.toString()
      );
      if (alreadyExists) {
        throw new ApiError(400, "Diamond already in wishlist");
      }
      wishlist.diamonds.push(productId);
    } else {
      const alreadyExists = wishlist.products.some(
        (id) => id && id.toString() === productId.toString()
      );
      if (alreadyExists) {
        throw new ApiError(400, "Product already in wishlist");
      }
      wishlist.products.push(productId);
    }

    await wishlist.save();

    const populatedWishlist = await Wishlist.findById(wishlist._id)
      .populate("products")
      .populate("diamonds");

    res.status(200).json(new ApiResponse(200, formatWishlist(populatedWishlist), "Item added to wishlist successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Remove product/diamond from wishlist
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
    await syncWishlistItems(wishlist);

    if (!wishlist.diamonds) {
      wishlist.diamonds = [];
    }

    const productIndex = wishlist.products.findIndex(
      (id) => id && id.toString() === productId.toString()
    );

    const diamondIndex = wishlist.diamonds.findIndex(
      (id) => id && id.toString() === productId.toString()
    );

    if (productIndex === -1 && diamondIndex === -1) {
      throw new ApiError(404, "Item not found in wishlist");
    }

    if (productIndex > -1) {
      wishlist.products.splice(productIndex, 1);
    }
    if (diamondIndex > -1) {
      wishlist.diamonds.splice(diamondIndex, 1);
    }

    await wishlist.save();

    const populatedWishlist = await Wishlist.findById(wishlist._id)
      .populate("products")
      .populate("diamonds");

    res.status(200).json(new ApiResponse(200, formatWishlist(populatedWishlist), "Item removed from wishlist successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Toggle product/diamond in wishlist (add if not present, remove if present)
const toggleWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId } = req.body;

    if (!productId) {
      throw new ApiError(400, "Product ID is required");
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [], diamonds: [] });
    } else {
      await syncWishlistItems(wishlist);
    }

    if (!wishlist.diamonds) {
      wishlist.diamonds = [];
    }

    const Product = require("../Models/Product.Model");
    const DiamondPrice = require("../Models/DiamondPrice.Model");

    const isDiamond = mongoose.isValidObjectId(productId) && await DiamondPrice.exists({ _id: productId });

    let message;
    if (isDiamond) {
      const diamondIndex = wishlist.diamonds.findIndex(
        (id) => id && id.toString() === productId.toString()
      );
      if (diamondIndex > -1) {
        wishlist.diamonds.splice(diamondIndex, 1);
        message = "Diamond removed from wishlist";
      } else {
        wishlist.diamonds.push(productId);
        message = "Diamond added to wishlist";
      }
    } else {
      const productIndex = wishlist.products.findIndex(
        (id) => id && id.toString() === productId.toString()
      );
      if (productIndex > -1) {
        wishlist.products.splice(productIndex, 1);
        message = "Product removed from wishlist";
      } else {
        wishlist.products.push(productId);
        message = "Product added to wishlist";
      }
    }

    await wishlist.save();

    const populatedWishlist = await Wishlist.findById(wishlist._id)
      .populate("products")
      .populate("diamonds");

    res.status(200).json(new ApiResponse(200, formatWishlist(populatedWishlist), message));
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
      wishlist.diamonds = [];
      await wishlist.save();
    }

    res.status(200).json(new ApiResponse(200, formatWishlist(wishlist), "Wishlist cleared successfully"));
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
