const Cart = require("../Models/Cart.Model");
const Coupon = require("../Models/Coupon.Model");
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

// Helper to recalculate coupon discounts on the cart
const recalculateCartDiscount = async (cart) => {
  if (!cart.couponCode) {
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    return cart;
  }

  const subTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const coupon = await Coupon.findOne({ code: cart.couponCode.toUpperCase(), isActive: true });
  if (!coupon) {
    // Reset coupon if no longer valid
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    return cart;
  }

  // Check expiry
  if (new Date() > coupon.expiryDate) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    return cart;
  }

  // Check usage limit
  if (coupon.usedCount >= coupon.usageLimit) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
    return cart;
  }

  // Check minimum order amount
  if (subTotal < coupon.minOrderAmount) {
    cart.couponCode = null;
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.discountValue = 0;
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
  }

  cart.discountAmount = Math.min(discount, subTotal);
  cart.discountType = coupon.discountType;
  cart.discountValue = coupon.discountValue;

  return cart;
};

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    let cart = await Cart.findOne({ user: userId }).populate("items.product").populate("items.diamond");
    
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    } else {
      // Recalculate discount to ensure validity
      await recalculateCartDiscount(cart);
      await cart.save();
      // Refetch with populated details
      cart = await Cart.findById(cart._id).populate("items.product").populate("items.diamond");
    }
    
    res.status(200).json(new ApiResponse(200, cart, "Cart fetched successfully"));
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

    if (diamond) {
      // Check if this loose diamond is already in the cart
      const existingItemIndex = cart.items.findIndex(
        (item) => item.diamond && item.diamond.toString() === diamond.toString()
      );

      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += Number(quantity);
        cart.items[existingItemIndex].price = price;
      } else {
        cart.items.push({
          diamond,
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
          item.product.toString() === product.toString() &&
          item.metal === metal &&
          (item.carat || "") === (carat || "") &&
          (item.clarity || "") === (clarity || "") &&
          (item.color || "") === (color || "") &&
          (item.size || "") === (size || "") &&
          (item.diamondType || "") === (diamondType || "")
      );

      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += Number(quantity);
        cart.items[existingItemIndex].price = price;
      } else {
        cart.items.push({
          product,
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
    const populatedCart = await Cart.findById(cart._id).populate("items.product").populate("items.diamond");
    res.status(200).json(new ApiResponse(200, populatedCart, "Item added to cart successfully"));
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

    const populatedCart = await Cart.findById(cart._id).populate("items.product").populate("items.diamond");
    res.status(200).json(new ApiResponse(200, populatedCart, "Cart item updated successfully"));
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

    const populatedCart = await Cart.findById(cart._id).populate("items.product").populate("items.diamond");
    res.status(200).json(new ApiResponse(200, populatedCart, "Item removed from cart successfully"));
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
      await cart.save();
    }

    res.status(200).json(new ApiResponse(200, cart, "Cart cleared successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Apply Coupon to Cart
const applyCoupon = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { code } = req.body;

    if (!code) {
      throw new ApiError(400, "Coupon code is required");
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      throw new ApiError(400, "Cannot apply coupon to an empty cart");
    }

    const subTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      throw new ApiError(404, "Invalid coupon code");
    }

    // Expiry check
    if (new Date() > coupon.expiryDate) {
      throw new ApiError(400, "Coupon has expired");
    }

    // Usage check
    if (coupon.usedCount >= coupon.usageLimit) {
      throw new ApiError(400, "Coupon usage limit reached");
    }

    // Min order amount check
    if (subTotal < coupon.minOrderAmount) {
      throw new ApiError(400, `Minimum order amount of $${coupon.minOrderAmount} required to apply this coupon`);
    }

    cart.couponCode = coupon.code;
    
    await recalculateCartDiscount(cart);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate("items.product").populate("items.diamond");
    res.status(200).json(new ApiResponse(200, populatedCart, "Coupon applied successfully"));
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

    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate("items.product").populate("items.diamond");
    res.status(200).json(new ApiResponse(200, populatedCart, "Coupon removed successfully"));
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
};
