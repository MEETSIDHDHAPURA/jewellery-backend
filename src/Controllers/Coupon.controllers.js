const Coupon = require("../Models/Coupon.Model");
const CouponUsage = require("../Models/CouponUsage.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const logActivity = require("../Utils/logActivity");

// ─── Create Coupon ───
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expiryDate,
      usageLimit,
      usageLimitPerCustomer,
      eligibility,
      applicableCategories,
      allowStacking,
      applyOnSaleProducts,
    } = req.body;

    if (!code || !discountType || discountValue === undefined || !expiryDate) {
      throw new ApiError(400, "Code, discountType, discountValue, and expiryDate are required");
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) throw new ApiError(409, "Coupon code already exists");

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expiryDate,
      usageLimit,
      usageLimitPerCustomer,
      eligibility,
      applicableCategories,
      allowStacking,
      applyOnSaleProducts,
    });

    await logActivity(req, "Create", `create coupon ${coupon.code}`);

    res.status(201).json(new ApiResponse(201, coupon, "Coupon created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Update Coupon ───
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) throw new ApiError(404, "Coupon not found");

    // Allowed updatable fields
    const updatableFields = [
      "code",
      "description",
      "discountType",
      "discountValue",
      "minOrderAmount",
      "maxDiscountAmount",
      "startDate",
      "expiryDate",
      "usageLimit",
      "usageLimitPerCustomer",
      "eligibility",
      "applicableCategories",
      "allowStacking",
      "applyOnSaleProducts",
      "isActive",
    ];

    const originalCode = coupon.code;

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        if (field === "code") {
          // Check uniqueness of new code
          const existingCode = await Coupon.findOne({
            code: req.body.code.toUpperCase(),
            _id: { $ne: id },
          });
          if (existingCode) throw new ApiError(409, "Coupon code already exists");
          coupon.code = req.body.code.toUpperCase();
        } else {
          coupon[field] = req.body[field];
        }
      }
    }

    await coupon.save();

    const action = originalCode !== coupon.code
      ? `Update coupon code ${originalCode} to ${coupon.code}`
      : `Update coupon: ${coupon.code}`;
    await logActivity(req, "Update", action);

    const populated = await Coupon.findById(coupon._id).populate("applicableCategories");
    res.status(200).json(new ApiResponse(200, populated, "Coupon updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Delete Coupon ───
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) throw new ApiError(404, "Coupon not found");

    await logActivity(req, "Delete", `Delete this coupon ${coupon.code}`);

    res.status(200).json(new ApiResponse(200, null, "Coupon deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Get Coupon By ID ───
const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id).populate("applicableCategories");
    if (!coupon) throw new ApiError(404, "Coupon not found");

    res.status(200).json(new ApiResponse(200, coupon, "Coupon fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Get All Coupons (with optional filters) ───
const getAllCoupons = async (req, res) => {
  try {
    const { status } = req.query; // "active", "inactive", "expired"

    let filter = {};
    const now = new Date();

    if (status === "active") {
      filter.isActive = true;
      filter.expiryDate = { $gte: now };
    } else if (status === "inactive") {
      filter.isActive = false;
    } else if (status === "expired") {
      filter.expiryDate = { $lt: now };
    }

    const coupons = await Coupon.find(filter)
      .populate("applicableCategories")
      .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, coupons, "Coupons fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Toggle Coupon Status ───
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) throw new ApiError(404, "Coupon not found");

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    await logActivity(req, "Update", `Update coupon status of ${coupon.code} to ${coupon.isActive ? "Active" : "Inactive"}`);

    res.status(200).json(
      new ApiResponse(200, coupon, `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`)
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Validate Coupon (Enhanced with all rules) ───
const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount, userId, cartCategoryIds } = req.body;

    if (!code) throw new ApiError(400, "Coupon code is required");

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) throw new ApiError(404, "Invalid coupon code");

    const now = new Date();

    // 1. Check start date
    if (coupon.startDate && now < coupon.startDate) {
      throw new ApiError(400, "This coupon is not yet active");
    }

    // 2. Check expiry date
    if (now > coupon.expiryDate) {
      throw new ApiError(400, "Coupon has expired");
    }

    // 3. Check global usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      throw new ApiError(400, "Coupon usage limit reached");
    }

    // 4. Check per-customer usage limit
    if (userId) {
      const customerUsageCount = await CouponUsage.countDocuments({
        coupon: coupon._id,
        user: userId,
      });
      if (customerUsageCount >= coupon.usageLimitPerCustomer) {
        throw new ApiError(400, "You have already used this coupon the maximum number of times");
      }
    }

    // 5. Check eligibility
    if (coupon.eligibility === "logged_in" && !userId) {
      throw new ApiError(400, "This coupon is only available for logged-in customers");
    }

    // 6. Check minimum order amount
    if (orderAmount !== undefined && orderAmount < coupon.minOrderAmount) {
      throw new ApiError(400, `Minimum order amount of ₹${coupon.minOrderAmount} required`);
    }

    // 7. Check applicable categories
    if (coupon.applicableCategories && coupon.applicableCategories.length > 0 && cartCategoryIds) {
      const applicableCatStrings = coupon.applicableCategories.map((c) => c.toString());
      const hasMatchingCategory = cartCategoryIds.some((catId) =>
        applicableCatStrings.includes(catId.toString())
      );
      if (!hasMatchingCategory) {
        throw new ApiError(400, "This coupon is not applicable to the items in your cart");
      }
    }

    // 8. Calculate discount
    let discount = 0;
    if (coupon.discountType === "Percentage") {
      discount = ((orderAmount || 0) * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount !== undefined && coupon.maxDiscountAmount !== null) {
        discount = Math.min(discount, coupon.maxDiscountAmount);
      }
    } else if (coupon.discountType === "Fixed") {
      discount = coupon.discountValue;
    } else if (coupon.discountType === "FreeShipping") {
      discount = 0; // No monetary discount, just free shipping flag
    }

    discount = Math.min(discount, orderAmount || 0);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          coupon,
          calculatedDiscount: discount,
          freeShipping: coupon.discountType === "FreeShipping",
        },
        "Coupon validated successfully"
      )
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Coupon Report (Usage Count + Revenue) ───
const getCouponReport = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id).populate("applicableCategories");
    if (!coupon) throw new ApiError(404, "Coupon not found");

    // Aggregate usage data
    const usageStats = await CouponUsage.aggregate([
      { $match: { coupon: coupon._id } },
      {
        $group: {
          _id: null,
          totalUsageCount: { $sum: 1 },
          totalDiscountGiven: { $sum: "$discountAmount" },
          totalOrderRevenue: { $sum: "$orderTotal" },
          uniqueCustomers: { $addToSet: "$user" },
        },
      },
    ]);

    const stats = usageStats[0] || {
      totalUsageCount: 0,
      totalDiscountGiven: 0,
      totalOrderRevenue: 0,
      uniqueCustomers: [],
    };

    // Recent usage history (last 20)
    const recentUsages = await CouponUsage.find({ coupon: coupon._id })
      .populate("user", "name email")
      .populate("order", "orderId totalAmount")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          coupon,
          report: {
            totalUsageCount: stats.totalUsageCount,
            totalDiscountGiven: stats.totalDiscountGiven,
            totalOrderRevenue: stats.totalOrderRevenue,
            uniqueCustomerCount: stats.uniqueCustomers.length,
            remainingUses: coupon.usageLimit - coupon.usedCount,
          },
          recentUsages,
        },
        "Coupon report fetched successfully"
      )
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponById,
  getAllCoupons,
  toggleCouponStatus,
  validateCoupon,
  getCouponReport,
};
