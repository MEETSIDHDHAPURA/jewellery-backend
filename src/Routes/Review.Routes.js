const express = require("express");
const reviewController = require("../Controllers/Review.controllers");
const upload = require("../Middlewares/multer.middleware");

const router = express.Router();

// Route to get all reviews (globally for admin)
router.get("/all", reviewController.getAllReviews);

// Route to get all reviews for a specific product
router.get("/:productId", reviewController.getProductReviews);

// Route to add a new review to a product (supports multiple media files)
router.post("/:productId", upload.array("media", 5), reviewController.createReview);

// Route to delete a review
router.delete("/:reviewId", reviewController.deleteReview);

// Route to update a review (supports adding new media files)
router.patch("/:reviewId", upload.array("media", 5), reviewController.updateReview);

module.exports = router;
