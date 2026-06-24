const Cart = require("../Models/Cart.Model");
const Coupon = require("../Models/Coupon.Model");
const CouponUsage = require("../Models/CouponUsage.Model");
const User = require("../Models/User.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const mongoose = require("mongoose");

// Helper to get string representation of ObjectId (populated or unpopulated)
const getObjectIdString = (field) => {
  if (!field) return "";
  return field._id ? field._id.toString() : field.toString();
};

// Helper to normalize variant string values for comparison
const normalizeVal = (val) => {
  if (val === undefined || val === null) return "";
  return String(val).toLowerCase().replace(/[\s_-]/g, "");
};

// Helper to format generic diamonds dynamically in cart responses
const formatCartResponse = (cart) => {
  if (!cart) return null;
  const cartObj = cart.toObject ? cart.toObject() : cart;

  if (cartObj.items && Array.isArray(cartObj.items)) {
    cartObj.items = cartObj.items.map((item) => {
      const isLooseDiamond = item.metal === "-" || item.diamond || item.shape;
      if (isLooseDiamond && !item.diamond) {
        item.diamond = {
          _id: item._id,
          shape: item.shape || item.product || "Round",
          carat: Number(item.carat) || 1.0,
          clarity: item.clarity || "VS1",
          color: item.color || "G",
          diamondType: item.diamondType || "Lab Grown",
          price: item.price,
          image: [],
          sku: item.sku || `${(item.shape || "ROUND").toUpperCase()}-${item.carat || "1.00"}-${item.color || "G"}-${item.clarity || "VS1"}`
        };
        item.product = null;
      }
      return item;
    });
  }

  return cartObj;
};

// Helper to get user ID from request (token or body/query)
const getUserId = (req) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User ID is required / User is not authenticated");
  }
  return userId;
};

// Helper to recalculate coupon discounts on the cart (enhanced with all rules)
const recalculateCartDiscount = async (cart) => {
  if (!cart.couponCode) {
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    cart.freeShipping = false;
    return cart;
  }

  const coupon = await Coupon.findOne({ code: cart.couponCode.toUpperCase(), isActive: true });
  if (!coupon) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    cart.freeShipping = false;
    return cart;
  }

  // Check country and province limits
  if (coupon.country && coupon.country !== "all") {
    let finalCountry = "";
    let finalProvince = "";
    if (cart.user) {
      const user = await User.findById(cart.user);
      const defaultAddress = user?.addresses?.find(addr => addr.isDefault) || user?.addresses?.[0];
      if (defaultAddress) {
        finalCountry = defaultAddress.country;
        finalProvince = defaultAddress.state;
      }
    }

    if (!finalCountry || finalCountry.toLowerCase() !== coupon.country.toLowerCase()) {
      cart.couponCode = null;
      cart.discountAmount = 0;
      cart.discountType = null;
      cart.discountValue = 0;
      cart.freeShipping = false;
      return cart;
    }

    if (coupon.country.toUpperCase() === "USA" && coupon.province && coupon.province.toLowerCase() !== "all") {
      const allowedProvinces = coupon.province.split(",").map(p => p.trim().toLowerCase());
      if (!finalProvince || !allowedProvinces.includes(finalProvince.toLowerCase())) {
        cart.couponCode = null;
        cart.discountAmount = 0;
        cart.discountType = null;
        cart.discountValue = 0;
        cart.freeShipping = false;
        return cart;
      }
    }
  }

  const now = new Date();

  // Check start date
  if (coupon.startDate && now < coupon.startDate) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    cart.freeShipping = false;
    return cart;
  }

  // Check expiry
  if (now > coupon.expiryDate) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    cart.freeShipping = false;
    return cart;
  }

  // Check usage limit
  if (coupon.usedCount >= coupon.usageLimit) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    cart.freeShipping = false;
    return cart;
  }

  if (cart.items && cart.items.length > 0) {
    const needsProductPopulate = cart.items.some(item => item.product && mongoose.Types.ObjectId.isValid(item.product) && !item.product.category);
    const needsDiamondPopulate = cart.items.some(item => item.diamond && mongoose.Types.ObjectId.isValid(item.diamond) && typeof item.diamond.shape === 'undefined');

    const populatePaths = [];
    if (needsProductPopulate) {
      populatePaths.push({ path: "items.product", populate: { path: "category" } });
    }
    if (needsDiamondPopulate) {
      populatePaths.push({ path: "items.diamond" });
    }
    if (populatePaths.length > 0) {
      await cart.populate(populatePaths);
    }
  }

  // Determine which items the coupon applies to
  let applicableItems = cart.items;

  // Category restriction: filter items to only those in applicable categories
  if (coupon.applicableCategories && coupon.applicableCategories.length > 0 && !coupon.applicableCategories.includes("all")) {
    const applicableCatStrings = coupon.applicableCategories.map((c) => c.toString());

    applicableItems = cart.items.filter((item) => {
      const isItemLooseDiamond = item.metal === "-" || item.diamond || item.shape;
      if (isItemLooseDiamond) {
        if (applicableCatStrings.includes("diamond")) {
          if (coupon.applicableShapes && coupon.applicableShapes.length > 0 && !coupon.applicableShapes.includes("all")) {
            const diamondShape = item.diamond ? item.diamond.shape : (item.shape || item.product);
            return diamondShape && coupon.applicableShapes.includes(diamondShape);
          }
          return true;
        }
      } else if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        const productCategory = item.product.category
          ? getObjectIdString(item.product.category)
          : null;
        return productCategory && applicableCatStrings.includes(productCategory);
      }

      return false;
    });

    // If no items match the category, remove coupon
    if (applicableItems.length === 0) {
      cart.couponCode = null;
      cart.discountAmount = 0;
      cart.discountType = null;
      cart.discountValue = 0;
      cart.freeShipping = false;
      return cart;
    }
  }

  // Calculate subtotal from applicable items
  const subTotal = applicableItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Check minimum order amount (against full cart total)
  const fullSubTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (fullSubTotal < coupon.minOrderAmount) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    cart.freeShipping = false;
    return cart;
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === "Percentage") {
    discount = (subTotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount !== undefined && coupon.maxDiscountAmount !== null) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else if (coupon.discountType === "Fixed") {
    discount = coupon.discountValue;
  } else if (coupon.discountType === "FreeShipping") {
    discount = 0;
    cart.freeShipping = true;
  }

  cart.discountAmount = Math.min(discount, subTotal);
  cart.discountType = coupon.discountType;
  cart.discountValue = coupon.discountValue;

  if (coupon.discountType !== "FreeShipping") {
    cart.freeShipping = false;
  }

  return cart;
};

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    let cart = await Cart.findOne({ user: userId }).populate({ path: "items.product", populate: { path: "category" } }).populate("items.diamond");

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    } else {
      // Recalculate discount to ensure validity
      await recalculateCartDiscount(cart);
      await cart.save();
      // Refetch with populated details
      cart = await Cart.findById(cart._id).populate({ path: "items.product", populate: { path: "category" } }).populate("items.diamond");
    }

    res.status(200).json(new ApiResponse(200, formatCartResponse(cart), "Cart fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Add item to cart (supports both jewelry Products and Loose Diamonds)
const addToCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { product, diamond, metal, carat, clarity, color, size, diamondType, quantity = 1, price } = req.body;

    if (!product && !diamond) {
      throw new ApiError(400, "Product or Diamond ID is required");
    }

    if (price === undefined) {
      throw new ApiError(400, "Price is required");
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const diamondShapes = ["Round", "Oval", "Cushion", "Princess", "Pear", "Radiant", "Emerald", "Marquise", "Heart", "Asscher"];
    const isGenericShape = typeof product === "string" && diamondShapes.includes(product);
    const isMetalEmpty = metal === "-";
    const isLooseDiamond = isGenericShape || isMetalEmpty || (diamond && mongoose.Types.ObjectId.isValid(diamond));

    if (isLooseDiamond) {
      let cartDiamond = null;
      let cartShape = null;

      if (diamond && mongoose.Types.ObjectId.isValid(diamond)) {
        cartDiamond = diamond;
      } else if (product && mongoose.Types.ObjectId.isValid(product)) {
        cartDiamond = product;
      } else if (product && typeof product === "string" && diamondShapes.includes(product)) {
        cartShape = product;
      }

      // Check if this loose diamond (specific or generic) is already in the cart
      const existingItemIndex = cart.items.findIndex((item) => {
        const isItemLooseDiamond = item.metal === "-" || item.diamond || item.shape;
        if (!isItemLooseDiamond) return false;

        if (cartDiamond && item.diamond) {
          return item.diamond.toString() === cartDiamond.toString();
        }

        if (!cartDiamond && !item.diamond) {
          const itemShape = item.shape || item.product;
          return (
            normalizeVal(itemShape) === normalizeVal(cartShape) &&
            normalizeVal(item.carat) === normalizeVal(carat) &&
            normalizeVal(item.clarity) === normalizeVal(clarity) &&
            normalizeVal(item.color) === normalizeVal(color) &&
            normalizeVal(item.diamondType) === normalizeVal(diamondType)
          );
        }

        return false;
      });

      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += Number(quantity);
        cart.items[existingItemIndex].price = price;
      } else {
        cart.items.push({
          product: null,
          diamond: cartDiamond,
          shape: cartShape,
          metal: metal || "-",
          carat,
          clarity,
          color,
          size,
          diamondType,
          quantity: Number(quantity),
          price,
        });
      }
    } else {
      if (!metal) {
        throw new ApiError(400, "Metal is required for products");
      }

      // Check if the product variation is already in the cart
      const existingItemIndex = cart.items.findIndex(
        (item) =>
          item.product &&
          getObjectIdString(item.product) === product.toString() &&
          normalizeVal(item.metal) === normalizeVal(metal) &&
          normalizeVal(item.carat) === normalizeVal(carat) &&
          normalizeVal(item.clarity) === normalizeVal(clarity) &&
          normalizeVal(item.color) === normalizeVal(color) &&
          normalizeVal(item.size) === normalizeVal(size) &&
          normalizeVal(item.diamondType) === normalizeVal(diamondType)
      );

      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += Number(quantity);
        cart.items[existingItemIndex].price = price;
      } else {
        cart.items.push({
          product,
          diamond: null,
          shape: null,
          metal,
          carat,
          clarity,
          color,
          size,
          diamondType,
          quantity: Number(quantity),
          price,
        });
      }
    }

    await recalculateCartDiscount(cart);
    await cart.save();

    // Return the populated cart
    const populatedCart = await Cart.findById(cart._id).populate({ path: "items.product", populate: { path: "category" } }).populate("items.diamond");
    res.status(200).json(new ApiResponse(200, formatCartResponse(populatedCart), "Item added to cart successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { itemId, quantity } = req.body;

    if (!itemId || quantity === undefined) {
      throw new ApiError(400, "Item ID and Quantity are required");
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }

    const itemIndex = cart.items.findIndex((item) => item._id.toString() === itemId.toString());
    if (itemIndex === -1) {
      throw new ApiError(404, "Item not found in cart");
    }

    const targetQuantity = Number(quantity);
    if (targetQuantity <= 0) {
      // Remove item if quantity is 0 or less
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = targetQuantity;
    }

    await recalculateCartDiscount(cart);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({ path: "items.product", populate: { path: "category" } }).populate("items.diamond");
    res.status(200).json(new ApiResponse(200, formatCartResponse(populatedCart), "Cart item updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    const itemId = req.params.itemId || req.body.itemId;

    if (!itemId) {
      throw new ApiError(400, "Item ID is required");
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }

    const itemIndex = cart.items.findIndex((item) => item._id.toString() === itemId.toString());
    if (itemIndex === -1) {
      throw new ApiError(404, "Item not found in cart");
    }

    cart.items.splice(itemIndex, 1);
    await recalculateCartDiscount(cart);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({ path: "items.product", populate: { path: "category" } }).populate("items.diamond");
    res.status(200).json(new ApiResponse(200, formatCartResponse(populatedCart), "Item removed from cart successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    const cart = await Cart.findOne({ user: userId });

    if (cart) {
      cart.items = [];
      cart.couponCode = null;
      cart.discountAmount = 0;
      cart.discountType = null;
      cart.discountValue = 0;
      cart.freeShipping = false;
      await cart.save();
    }

    res.status(200).json(new ApiResponse(200, formatCartResponse(cart), "Cart cleared successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Apply Coupon to Cart (Enhanced with all rules)
const applyCoupon = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { code } = req.body;

    if (!code) {
      throw new ApiError(400, "Coupon code is required");
    }

    let cart = await Cart.findOne({ user: userId })
      .populate({ path: "items.product", populate: { path: "category" } })
      .populate("items.diamond");
    if (!cart || cart.items.length === 0) {
      throw new ApiError(400, "Cannot apply coupon to an empty cart");
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      throw new ApiError(404, "Invalid coupon code");
    }

    const now = new Date();

    // 1. Check start date
    if (coupon.startDate && now < coupon.startDate) {
      throw new ApiError(400, "This coupon is not yet active");
    }

    // 2. Check expiry date
    if (now > coupon.expiryDate) {
      throw new ApiError(400, "Coupon has expired");
    }

    // 3. Check global usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      throw new ApiError(400, "Coupon usage limit reached");
    }

    // 4. Check per-customer usage limit
    const customerUsageCount = await CouponUsage.countDocuments({
      coupon: coupon._id,
      user: userId,
    });
    if (customerUsageCount >= coupon.usageLimitPerCustomer) {
      throw new ApiError(400, "You have already used this coupon the maximum number of times");
    }

    // 5. Check eligibility
    if (coupon.eligibility === "logged_in" && !req.user?._id) {
      throw new ApiError(400, "This coupon is only available for logged-in customers");
    }

    // 6. Check if another coupon is already applied
    if (cart.couponCode && cart.couponCode !== code.toUpperCase()) {
      throw new ApiError(400, "Only one coupon can be applied. Remove the existing coupon first.");
    }

    // 7. Check minimum order amount
    const subTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (subTotal < coupon.minOrderAmount) {
      throw new ApiError(400, `Minimum order amount of ₹${coupon.minOrderAmount} required to apply this coupon`);
    }

    // 8. Check applicable categories
    if (coupon.applicableCategories && coupon.applicableCategories.length > 0 && !coupon.applicableCategories.includes("all")) {
      const applicableCatStrings = coupon.applicableCategories.map((c) => c.toString());
      const hasMatchingCategory = cart.items.some((item) => {
        const isItemLooseDiamond = item.metal === "-" || item.diamond || item.shape;
        if (isItemLooseDiamond) {
          if (applicableCatStrings.includes("diamond")) {
            if (coupon.applicableShapes && coupon.applicableShapes.length > 0 && !coupon.applicableShapes.includes("all")) {
              const diamondShape = item.diamond ? item.diamond.shape : (item.shape || item.product);
              return diamondShape && coupon.applicableShapes.includes(diamondShape);
            }
            return true;
          }
        } else if (item.product) {
          if (!item.product.category) return false;
          const catId = getObjectIdString(item.product.category);
          return applicableCatStrings.includes(catId);
        }
        return false;
      });
      if (!hasMatchingCategory) {
        throw new ApiError(400, "This coupon is not applicable to the items in your cart");
      }
    }

    // 8.5 Check country and province limits
    if (coupon.country && coupon.country !== "all") {
      let finalCountry = req.body.country;
      let finalProvince = req.body.province;

      if (!finalCountry && userId) {
        const user = await User.findById(userId);
        const defaultAddress = user?.addresses?.find(addr => addr.isDefault) || user?.addresses?.[0];
        if (defaultAddress) {
          finalCountry = defaultAddress.country;
          finalProvince = defaultAddress.state;
        }
      }

      if (!finalCountry || finalCountry.toLowerCase() !== coupon.country.toLowerCase()) {
        throw new ApiError(400, `This coupon is not available in your country (only valid for ${coupon.country})`);
      }

      if (coupon.country.toUpperCase() === "USA" && coupon.province && coupon.province.toLowerCase() !== "all") {
        const allowedProvinces = coupon.province.split(",").map(p => p.trim().toLowerCase());
        if (!finalProvince || !allowedProvinces.includes(finalProvince.toLowerCase())) {
          throw new ApiError(400, `This coupon is not available in your state (only valid for ${coupon.province})`);
        }
      }
    }

    // All checks passed - apply coupon
    cart.couponCode = coupon.code;

    // Re-fetch un-populated cart for saving
    const rawCart = await Cart.findById(cart._id);
    rawCart.couponCode = coupon.code;
    await recalculateCartDiscount(rawCart);
    await rawCart.save();

    const populatedCart = await Cart.findById(rawCart._id).populate({ path: "items.product", populate: { path: "category" } }).populate("items.diamond");
    res.status(200).json(new ApiResponse(200, formatCartResponse(populatedCart), "Coupon applied successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Remove Coupon from Cart
const removeCoupon = async (req, res) => {
  try {
    const userId = getUserId(req);

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Cart not found");
    }

    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    cart.freeShipping = false;

    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate({ path: "items.product", populate: { path: "category" } }).populate("items.diamond");
    res.status(200).json(new ApiResponse(200, formatCartResponse(populatedCart), "Coupon removed successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  recalculateCartDiscount,
};
