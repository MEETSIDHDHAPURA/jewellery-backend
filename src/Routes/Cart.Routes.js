const express = require("express");
const router = express.Router();
const { auth } = require("../Middlewares/auth.middleware");
const cartController = require("../Controllers/Cart.controllers");


router.get("/", auth, cartController.getCart);
router.post("/add", auth, cartController.addToCart);

// Update item quantity
router.put("/update-quantity", auth, cartController.updateCartItem);

// Remove item from cart (supports both DELETE with param and POST with body)
router.post("/remove", auth, cartController.removeFromCart);

// Clear entire cart
router.post("/clear", auth, cartController.clearCart);

// Apply and remove coupons
router.post("/apply-coupon", auth, cartController.applyCoupon);
router.post("/remove-coupon", auth, cartController.removeCoupon);

module.exports = router;
