const express = require("express");
const router = express.Router();
const { requireAuth } = require("../Middlewares/auth.middleware");
const wishlistController = require("../Controllers/Wishlist.controllers");

// Get user's wishlist
router.get("/", requireAuth, wishlistController.getWishlist);

// Add product to wishlist
router.post("/add", requireAuth, wishlistController.addToWishlist);

// Toggle product in wishlist (add/remove)
router.post("/toggle", requireAuth, wishlistController.toggleWishlist);

// Remove product from wishlist
router.delete("/remove/:productId", requireAuth, wishlistController.removeFromWishlist);
router.post("/remove", requireAuth, wishlistController.removeFromWishlist);

// Clear wishlist
router.delete("/clear", requireAuth, wishlistController.clearWishlist);

module.exports = router;
