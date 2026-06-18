const express = require("express");
const reviewController = require("../Controllers/Review.controllers");
const upload = require("../Middlewares/multer.middleware");
const { auth } = require("../Middlewares/auth.middleware");

const router = express.Router();

// Route to get all reviews (globally for admin)
router.get("/all", reviewController.getAllReviews);

// Route to check if user has purchased a product (for review eligibility)
router.get("/check-purchase/:productId", auth, reviewController.checkPurchaseStatus);

// Route to get all reviews for a specific product
router.get("/:productId", reviewController.getProductReviews);

// Route to add a new review to a product (supports multiple media files)
router.post("/:productId", upload.array("media", 5), reviewController.createReview);

// Route to delete a review
router.delete("/:reviewId", auth, reviewController.deleteReview);

// Route to update a review (supports adding new media files)
router.patch("/:reviewId", upload.array("media", 5), reviewController.updateReview);

// Route to toggle review visibility (admin hide/unhide)
router.patch("/:reviewId/toggle-visibility", auth, reviewController.toggleReviewVisibility);

module.exports = router;
