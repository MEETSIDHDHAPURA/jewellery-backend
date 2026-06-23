const express = require("express");
const reviewController = require("../Controllers/Review.controllers");
const upload = require("../Middlewares/multer.middleware");
const { requireAuth, adminOnly } = require("../Middlewares/auth.middleware");

const router = express.Router();

// Route to get all reviews (globally for admin)
router.get("/all", adminOnly, reviewController.getAllReviews);

// Route to check if user has purchased a product (for review eligibility)
router.get("/check-purchase/:productId", requireAuth, reviewController.checkPurchaseStatus);

// Route to get all reviews for a specific product
router.get("/:productId", reviewController.getProductReviews);

// Route to add a new review to a product (supports multiple media files)
router.post("/:productId", requireAuth, upload.array("media", 5), reviewController.createReview);

// Route to delete a review
router.delete("/:reviewId", requireAuth, reviewController.deleteReview);

// Route to update a review (supports adding new media files)
router.patch("/:reviewId", requireAuth, upload.array("media", 5), reviewController.updateReview);

// Route to toggle review visibility (admin hide/unhide)
router.patch("/:reviewId/toggle-visibility", adminOnly, reviewController.toggleReviewVisibility);

module.exports = router;
