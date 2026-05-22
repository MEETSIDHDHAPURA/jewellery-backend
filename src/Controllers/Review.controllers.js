const Review = require("../Models/Review.Model");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");

// Add a new review to a product
const createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment, userId } = req.body;

    // Use req.user if authentication middleware is used, otherwise expect userId in body
    const user = req.user ? req.user.id : userId;
    
    if (!user) {
      throw new ApiError(401, "User is required to submit a review");
    }

    if (!rating || !comment) {
      throw new ApiError(400, "Rating and comment are required");
    }

    const media = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        // Simple type check based on mimetype
        const type = file.mimetype.startsWith("video") ? "video" : "image";
        media.push({
          url: `/uploads/${file.filename}`,
          type,
        });
      });
    }

    const review = await Review.create({
      user,
      product: productId,
      rating: Number(rating),
      comment,
      media,
    });

    res.status(201).json(new ApiResponse(201, review, "Review submitted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get reviews for a specific product
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, reviews, "Reviews fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete a review
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByIdAndDelete(reviewId);
    
    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    res.status(200).json(new ApiResponse(200, {}, "Review deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update a review
const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    if (rating) review.rating = Number(rating);
    if (comment) review.comment = comment;

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const type = file.mimetype.startsWith("video") ? "video" : "image";
        review.media.push({
          url: `/uploads/${file.filename}`,
          type,
        });
      });
    }

    await review.save();

    res.status(200).json(new ApiResponse(200, review, "Review updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get all reviews
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("user", "name email avatar")
      .populate("product", "title images Price")
      .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, reviews, "All reviews fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createReview,
  getProductReviews,
  deleteReview,
  updateReview,
  getAllReviews
};

