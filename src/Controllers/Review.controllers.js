const Review = require("../Models/Review.Model");
const Order = require("../Models/Order.Model");
const ApiError = require("../Utils/ApiError");
const ApiResponse = require("../Utils/ApiResponse");
const logActivity = require("../Utils/logActivity");
const { uploadOnCloudinary } = require("../Utils/Cloudinary");

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

    // Verify user has purchased this product
    const hasPurchased = await Order.findOne({
      user: user,
      "items.product": productId,
      paymentStatus: { $in: ["Completed", "Pending"] },
    });

    if (!hasPurchased) {
      throw new ApiError(403, "You can only review products you have purchased");
    }

    const media = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Simple type check based on mimetype
        const type = file.mimetype.startsWith("video") ? "video" : "image";
        const uploadRes = await uploadOnCloudinary(file.path);
        if (uploadRes) {
          media.push({
            url: uploadRes.secure_url,
            type,
          });
        }
      }
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
    const reviews = await Review.find({ product: productId, isVisible: true })
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

    const shortComment = review.comment.length > 30 ? `${review.comment.substring(0, 30)}...` : review.comment;
    await logActivity(req, "Delete", `Delete review (Rating: ${review.rating}) with comment: "${shortComment}"`);

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
      for (const file of req.files) {
        const type = file.mimetype.startsWith("video") ? "video" : "image";
        const uploadRes = await uploadOnCloudinary(file.path);
        if (uploadRes) {
          review.media.push({
            url: uploadRes.secure_url,
            type,
          });
        }
      }
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
      .populate("product", "title metalImages Price")
      .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, reviews, "All reviews fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Check if a user has purchased a specific product
const checkPurchaseStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user ? req.user._id || req.user.id : req.query.userId;

    if (!userId) {
      return res.status(200).json(new ApiResponse(200, { hasPurchased: false }, "User not authenticated"));
    }

    const order = await Order.findOne({
      user: userId,
      "items.product": productId,
      paymentStatus: { $in: ["Completed", "Pending"] },
    });

    res.status(200).json(
      new ApiResponse(200, { hasPurchased: !!order }, order ? "User has purchased this product" : "User has not purchased this product")
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

const toggleReviewVisibility = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    review.isVisible = !review.isVisible;
    await review.save();

    await logActivity(
      req,
      "Update",
      `${review.isVisible ? "Unhide" : "Hide"} review (Rating: ${review.rating})`
    );

    res.status(200).json(new ApiResponse(200, review, `Review ${review.isVisible ? "visible" : "hidden"} successfully`));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createReview,
  getProductReviews,
  deleteReview,
  updateReview,
  getAllReviews,
  checkPurchaseStatus,
  toggleReviewVisibility
};

