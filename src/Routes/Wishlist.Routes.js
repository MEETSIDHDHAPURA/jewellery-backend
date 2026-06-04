const express = require("express");
const router = express.Router();
const { auth } = require("../Middlewares/auth.middleware");
const wishlistController = require("../Controllers/Wishlist.controllers");

// Get user's wishlist
router.get("/", auth, wishlistController.getWishlist);

// Add product to wishlist
router.post("/add", auth, wishlistController.addToWishlist);

// Toggle product in wishlist (add/remove)
router.post("/toggle", auth, wishlistController.toggleWishlist);

// Remove product from wishlist
router.delete("/remove/:productId", auth, wishlistController.removeFromWishlist);
router.post("/remove", auth, wishlistController.removeFromWishlist);

// Clear wishlist
router.delete("/clear", auth, wishlistController.clearWishlist);

module.exports = router;
