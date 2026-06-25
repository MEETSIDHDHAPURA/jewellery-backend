const Coupon = require("../Models/Coupon.Model");
const CouponUsage = require("../Models/CouponUsage.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const sendMail = require("../Utils/Nodemailer");
const logActivity = require("../Utils/logActivity");
const mongoose = require("mongoose");
const Category = require("../Models/Category.Model");
const { uploadOnCloudinary, updateOnCloudinary, deleteFromCloudinary } = require("../Utils/Cloudinary");

// Helper to manually populate applicableCategories (supporting mixed ObjectId and custom strings like 'diamond')
const populateCouponCategories = async (coupons) => {
  if (!coupons) return coupons;

  const isArray = Array.isArray(coupons);
  const list = isArray ? coupons : [coupons];

  // Collect all category IDs that are valid ObjectIds
  const categoryIds = [];
  list.forEach((c) => {
    if (c.applicableCategories && Array.isArray(c.applicableCategories)) {
      c.applicableCategories.forEach((cat) => {
        const idStr = cat?._id ? cat._id.toString() : cat?.toString();
        if (mongoose.Types.ObjectId.isValid(idStr)) {
          categoryIds.push(idStr);
        }
      });
    }
  });

  // Fetch category documents
  const categories = categoryIds.length > 0
    ? await Category.find({ _id: { $in: categoryIds } }).lean()
    : [];
  const categoryMap = new Map(categories.map((cat) => [cat._id.toString(), cat]));

  // Map back to the coupons
  list.forEach((c) => {
    if (c.applicableCategories && Array.isArray(c.applicableCategories)) {
      c.applicableCategories = c.applicableCategories.map((cat) => {
        const idStr = cat?._id ? cat._id.toString() : cat?.toString();
        if (categoryMap.has(idStr)) {
          return categoryMap.get(idStr);
        }
        if (idStr === "diamond") {
          return { _id: "diamond", name: "Diamond" };
        }
        return cat; // keep original if not found
      });
    }
  });

  return isArray ? list : list[0];
};

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
      applicableShapes,
      country,
      province,
      sendOnRegistration,
    } = req.body;

    if (!code || !discountType || discountValue === undefined || !expiryDate) {
      throw new ApiError(400, "Code, discountType, discountValue, and expiryDate are required");
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) throw new ApiError(409, "Coupon code already exists");

    // Handle image upload
    let imageUrl = "";
    if (req.file) {
      const uploadRes = await uploadOnCloudinary(req.file.path);
      if (uploadRes) {
        imageUrl = uploadRes.secure_url;
      }
    }

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
      applicableShapes: applicableCategories?.includes("diamond") ? applicableShapes || [] : [],
      country: country || "all",
      province: country === "USA" ? province || "" : "",
      sendOnRegistration: sendOnRegistration === "true" || sendOnRegistration === true,
      image: imageUrl,
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

    // Handle image upload
    if (req.file) {
      const uploadRes = await updateOnCloudinary(coupon.image, req.file.path);
      if (uploadRes) {
        coupon.image = uploadRes.secure_url;
      }
    }

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
      "applicableShapes",
      "isActive",
      "country",
      "province",
      "sendOnRegistration",
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
        } else if (field === "sendOnRegistration" || field === "isActive") {
          // Handle boolean conversion from FormData strings
          coupon[field] = req.body[field] === "true" || req.body[field] === true;
        } else {
          coupon[field] = req.body[field];
        }
      }
    }

    if (coupon.country !== "USA") {
      coupon.province = "";
    }

    if (coupon.applicableCategories && !coupon.applicableCategories.includes("diamond")) {
      coupon.applicableShapes = [];
    }

    await coupon.save();

    const action = originalCode !== coupon.code
      ? `Update coupon code ${originalCode} to ${coupon.code}`
      : `Update coupon: ${coupon.code}`;
    await logActivity(req, "Update", action);

    const couponDoc = await Coupon.findById(coupon._id).lean();
    const populated = await populateCouponCategories(couponDoc);
    res.status(200).json(new ApiResponse(200, populated, "Coupon updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Delete Coupon ───
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) throw new ApiError(404, "Coupon not found");

    // Clean up image from Cloudinary
    if (coupon.image) {
      await deleteFromCloudinary(coupon.image);
    }

    await Coupon.findByIdAndDelete(id);

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

    const couponDoc = await Coupon.findById(id).lean();
    if (!couponDoc) throw new ApiError(404, "Coupon not found");
    const coupon = await populateCouponCategories(couponDoc);

    res.status(200).json(new ApiResponse(200, coupon, "Coupon fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Get All Coupons (with optional filters) ───
const getAllCoupons = async (req, res) => {
  try {
    const { status, search, discountType, country, eligibility } = req.query;

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

    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (discountType && discountType !== "all") {
      filter.discountType = discountType;
    }

    if (country && country !== "all") {
      filter.country = country;
    }

    if (eligibility && eligibility !== "all") {
      filter.eligibility = eligibility;
    }

    const couponDocs = await Coupon.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    const coupons = await populateCouponCategories(couponDocs);

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
    const { code, orderAmount, userId, cartCategoryIds, cartDiamondShapes, country, province } = req.body;

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
    if (coupon.applicableCategories && coupon.applicableCategories.length > 0 && !coupon.applicableCategories.includes("all")) {
      const applicableCatStrings = coupon.applicableCategories.map((c) => c.toString());
      let hasMatchingCategory = false;

      if (cartCategoryIds && cartCategoryIds.length > 0) {
        hasMatchingCategory = cartCategoryIds.some((catId) =>
          applicableCatStrings.includes(catId.toString())
        );
      }

      if (!hasMatchingCategory && applicableCatStrings.includes("diamond")) {
        if (coupon.applicableShapes && coupon.applicableShapes.length > 0 && !coupon.applicableShapes.includes("all")) {
          if (cartDiamondShapes && cartDiamondShapes.length > 0) {
            hasMatchingCategory = cartDiamondShapes.some((shape) =>
              coupon.applicableShapes.includes(shape)
            );
          }
        } else {
          if (cartDiamondShapes && cartDiamondShapes.length > 0) {
            hasMatchingCategory = true;
          }
        }
      }

      if (!hasMatchingCategory) {
        throw new ApiError(400, "This coupon is not applicable to the items in your cart");
      }
    }

    // 7.5 Check country and province limits
    if (coupon.country && coupon.country !== "all") {
      let finalCountry = country;
      let finalProvince = province;
      
      if (!finalCountry && userId) {
        const User = require("../Models/User.Model");
        const user = await User.findById(userId);
        const defaultAddress = user?.addresses?.find(addr => addr.isDefault) || user?.addresses?.[0];
        if (defaultAddress) {
          finalCountry = defaultAddress.country;
          finalProvince = defaultAddress.state;
        }
      }

      if (!finalCountry || finalCountry.toLowerCase() !== coupon.country.toLowerCase()) {
        throw new ApiError(400, `This coupon is not available in your country (only valid for ${coupon.country})`);
      }

      if (coupon.country.toUpperCase() === "USA" && coupon.province && coupon.province.toLowerCase() !== "all") {
        const allowedProvinces = coupon.province.split(",").map(p => p.trim().toLowerCase());
        if (!finalProvince || !allowedProvinces.includes(finalProvince.toLowerCase())) {
          throw new ApiError(400, `This coupon is not available in your state (only valid for ${coupon.province})`);
        }
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

    const couponDoc = await Coupon.findById(id).lean();
    if (!couponDoc) throw new ApiError(404, "Coupon not found");
    const coupon = await populateCouponCategories(couponDoc);

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

// ─── Get Active Popup Coupon ───
const getPopupCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({
      isActive: true,
      sendOnRegistration: true,
      expiryDate: { $gt: new Date() },
    }).select("discountType discountValue description image");

    if (!coupon) {
      return res.status(200).json(new ApiResponse(200, null, "No active popup coupon found"));
    }

    res.status(200).json(new ApiResponse(200, coupon, "Popup coupon fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// ─── Send Coupon Code via Email ───
const sendCouponEmail = async (req, res) => {
  try {
    const { email, couponId } = req.body;
    if (!email || !couponId) {
      throw new ApiError(400, "Email and couponId are required");
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon || !coupon.isActive) {
      throw new ApiError(404, "Coupon not found or inactive");
    }

    const discountText = coupon.discountType === "Percentage" 
      ? `${coupon.discountValue}%` 
      : coupon.discountType === "Fixed" 
        ? `$${coupon.discountValue}` 
        : "Free Shipping";

    const storeName = process.env.STORE_NAME || "Praya Diamonds";
    const expiryDate = new Date(coupon.expiryDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build coupon image section if image exists
    const imageSection = coupon.image
      ? `<tr>
           <td style="padding: 0;">
             <img src="${coupon.image}" alt="Special Offer" style="width: 100%; max-height: 280px; object-fit: cover; display: block; border-radius: 12px 12px 0 0;" />
           </td>
         </tr>`
      : "";

    // Adjust top border radius if image is present
    const containerTopRadius = coupon.image ? "0" : "12px";

    const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your Exclusive Coupon</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f1eb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f1eb; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <!-- Coupon Image -->
              ${imageSection}

              <!-- Main Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px 36px 20px; border-radius: ${containerTopRadius} ${containerTopRadius} 0 0;">
                  
                  <!-- Store Name -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding-bottom: 8px;">
                        <span style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #d4af37; font-weight: 600;">
                          ${storeName}
                        </span>
                      </td>
                    </tr>
                  </table>

                  <!-- Heading -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding-bottom: 6px;">
                        <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1a1a1a; line-height: 1.3;">
                          Your Exclusive Gift Awaits
                        </h1>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-bottom: 24px;">
                        <div style="width: 40px; height: 2px; background-color: #d4af37; margin: 0 auto;"></div>
                      </td>
                    </tr>
                  </table>

                  <!-- Greeting -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="font-size: 15px; color: #555555; line-height: 1.7; text-align: center; padding-bottom: 28px;">
                        Thank you for your interest in ${storeName}! As promised, here is your exclusive <strong>${discountText} discount</strong> coupon. Use it on your next purchase to enjoy premium jewelry at a special price.
                      </td>
                    </tr>
                  </table>

                  <!-- Discount Badge -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding-bottom: 20px;">
                        <div style="background: linear-gradient(135deg, #d4af37 0%, #f0d875 50%, #d4af37 100%); color: #1a1a1a; font-size: 32px; font-weight: 800; letter-spacing: 1px; padding: 18px 40px; border-radius: 50px; display: inline-block; text-align: center; box-shadow: 0 4px 16px rgba(212,175,55,0.3);">
                          ${discountText} OFF
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- Coupon Code Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding-bottom: 12px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" style="background-color: #fdfaf3; border: 2px dashed #d4af37; border-radius: 10px; min-width: 280px;">
                          <tr>
                            <td style="padding: 18px 36px; text-align: center;">
                              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 6px;">Your Coupon Code</div>
                              <div style="font-family: 'Courier New', monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1a1a1a;">
                                ${coupon.code}
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Offer Description -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding: 8px 0 24px;">
                        <span style="font-size: 14px; color: #777; font-style: italic;">
                          ${coupon.description || "Exclusive discount on your next purchase"}
                        </span>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

              <!-- Divider + Expiry -->
              <tr>
                <td style="background-color: #ffffff; padding: 0 36px;">
                  <div style="border-top: 1px solid #eee;"></div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 20px 36px 32px; text-align: center;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <div style="background-color: #faf8f4; border-radius: 8px; padding: 14px 24px; display: inline-block;">
                          <span style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Valid Until</span>
                          <br />
                          <span style="font-size: 16px; color: #1a1a1a; font-weight: 600;">${expiryDate}</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #1a1a1a; padding: 28px 36px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="margin: 0 0 6px; font-size: 13px; color: #d4af37; font-weight: 600; letter-spacing: 1px;">
                    ${storeName}
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #888; line-height: 1.6;">
                    This is an automated email. Please do not reply directly.<br />
                    &copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    await sendMail(email, `🎁 Your Exclusive ${discountText} Discount Coupon from ${storeName}!`, emailHtml);

    res.status(200).json(new ApiResponse(200, null, "Coupon sent successfully"));
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
  getPopupCoupon,
  sendCouponEmail,
};
