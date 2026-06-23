const express = require("express");
const router = express.Router();
const { requireAuth } = require("../Middlewares/auth.middleware");
const cartController = require("../Controllers/Cart.controllers");


router.get("/", requireAuth, cartController.getCart);
router.post("/add", requireAuth, cartController.addToCart);

// Update item quantity
router.put("/update-quantity", requireAuth, cartController.updateCartItem);

// Remove item from cart (supports both DELETE with param and POST with body)
router.post("/remove", requireAuth, cartController.removeFromCart);

// Clear entire cart
router.post("/clear", requireAuth, cartController.clearCart);

// Apply and remove coupons
router.post("/apply-coupon", requireAuth, cartController.applyCoupon);
router.post("/remove-coupon", requireAuth, cartController.removeCoupon);

module.exports = router;
