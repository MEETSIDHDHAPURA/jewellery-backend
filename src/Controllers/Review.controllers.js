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

    const filter = { product: productId, isVisible: true };
    if (req.query.rating) {
      filter.rating = Number(req.query.rating);
    }

    let sort = { createdAt: -1 };
    if (req.query.sortBy === 'highest') {
      sort = { rating: -1, createdAt: -1 };
    } else if (req.query.sortBy === 'lowest') {
      sort = { rating: 1, createdAt: -1 };
    }

    if (req.query.page) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      const skip = (page - 1) * limit;

      const reviews = await Review.find(filter)
        .populate("user", "name avatar")
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const totalReviews = await Review.countDocuments(filter);

      return res.status(200).json(new ApiResponse(200, {
        reviews,
        pagination: {
          totalReviews,
          page,
          limit,
          totalPages: Math.ceil(totalReviews / limit),
          hasMore: page * limit < totalReviews
        }
      }, "Reviews fetched successfully"));
    } else {
      // Backwards compatibility for non-paginated queries (e.g. initial server-side page render)
      const reviews = await Review.find(filter)
        .populate("user", "name avatar")
        .sort(sort);

      return res.status(200).json(new ApiResponse(200, reviews, "Reviews fetched successfully"));
    }
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete a review
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    // Ensure requesting user owns the review or is an admin
    const reviewUserId = review.user._id ? review.user._id.toString() : review.user.toString();
    if (req.user?._id?.toString() !== reviewUserId && req.user?.role !== "admin" && req.user?.role !== "SuperAdmin") {
      throw new ApiError(403, "Access denied. You can only delete your own reviews.");
    }

    await Review.findByIdAndDelete(reviewId);

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

    // Ensure requesting user owns the review or is an admin
    const reviewUserId = review.user._id ? review.user._id.toString() : review.user.toString();
    if (req.user?._id?.toString() !== reviewUserId && req.user?.role !== "admin" && req.user?.role !== "SuperAdmin") {
      throw new ApiError(403, "Access denied. You can only update your own reviews.");
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
    const { search, rating } = req.query;
    let filter = {};

    if (rating && rating !== "all") {
      filter.rating = Number(rating);
    }

    if (search) {
      const User = require("../Models/User.Model");
      const Product = require("../Models/Product.Model");

      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }).select("_id");
      const userIds = matchingUsers.map(u => u._id);

      const matchingProducts = await Product.find({
        title: { $regex: search, $options: "i" }
      }).select("_id");
      const productIds = matchingProducts.map(p => p._id);

      filter.$or = [
        { comment: { $regex: search, $options: "i" } },
        { user: { $in: userIds } },
        { product: { $in: productIds } }
      ];
    }

    const reviews = await Review.find(filter)
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

