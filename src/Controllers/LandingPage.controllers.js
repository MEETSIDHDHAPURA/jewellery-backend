const HomepageSection = require("../Models/LandingPage.Modal");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { seedHomepageSections } = require("../Utils/HomepageSectionSeeder");
const Banner = require("../Models/Banner.Model");
const Category = require("../Models/Category.Model");
const Product = require("../Models/Product.Model");
const Order = require("../Models/Order.Model");

// Simple In-memory cache for landing page data
let landingPageCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Function to clear cache when data is modified
const clearLandingPageCache = () => {
  landingPageCache = null;
  cacheExpiry = 0;
};


// Get all sections with status (self-healing/seeding if empty)
const getAllHomepageSections = async (req, res) => {
  try {
    let sections = await HomepageSection.find();
    if (sections.length === 0) {
      await seedHomepageSections();
      sections = await HomepageSection.find();
    }
    res.status(200).json(new ApiResponse(200, sections, "Homepage sections fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Toggle active or inactive status


const toggleActiveHomepageSection = async (req, res) => {
  try {
    const { section_key } = req.params;
    const { is_active } = req.body; // allows explicitly passing status

    const section = await HomepageSection.findOne({ section_key });
    if (!section) {
      throw new ApiError(404, `Homepage section not found: ${section_key}`);
    }

    section.is_active = is_active !== undefined ? is_active : !section.is_active;
    await section.save();
    clearLandingPageCache();

    res.status(200).json(new ApiResponse(200, section, `Homepage section '${section_key}' toggle successful`));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Switch display mode (featured_products and new_arrivals only)
const updateDisplayModeHomepageSection = async (req, res) => {
  try {
    const { section_key } = req.params;
    const displayMode = req.body.displayMode || req.body.display_mode;

    const section = await HomepageSection.findOne({ section_key });
    if (!section) {
      throw new ApiError(404, `Homepage section not found: ${section_key}`);
    }

    if (section_key === "featured_products") {
      if (displayMode !== "featured" && displayMode !== "best_sellers") {
        throw new ApiError(400, "For featured_products, display_mode must be 'featured' or 'best_sellers'");
      }
    } else if (section_key === "new_arrivals") {
      if (displayMode !== "new_arrivals" && displayMode !== "best_deal") {
        throw new ApiError(400, "For new_arrivals, display_mode must be 'new_arrivals' or 'best_deal'");
      }
    } else {
      throw new ApiError(400, `Section '${section_key}' does not support customizable display modes`);
    }

    section.display_mode = displayMode;
    await section.save();
    clearLandingPageCache();

    res.status(200).json(new ApiResponse(200, section, `Homepage section '${section_key}' display mode updated to '${displayMode}' successfully`));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Create new homepage section
const createHomepageSection = async (req, res) => {
  try {
    const { section_key, is_active, display_mode } = req.body;
    if (!section_key) {
      throw new ApiError(400, "section_key is required");
    }

    const existing = await HomepageSection.findOne({ section_key });
    if (existing) {
      throw new ApiError(400, `Homepage section '${section_key}' already exists`);
    }

    const section = await HomepageSection.create({
      section_key,
      is_active: is_active !== undefined ? is_active : true,
      display_mode: display_mode || null,
    });
    clearLandingPageCache();

    res.status(201).json(new ApiResponse(201, section, "Homepage section created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

const getLandingPageData = async (req, res) => {
  try {
    const now = Date.now();
    if (landingPageCache && now < cacheExpiry) {
      return res.status(200).json(landingPageCache);
    }

    // 1. Get all sections and seed if empty
    let sections = await HomepageSection.find().sort({ display_order: 1 });
    if (sections.length === 0) {
      await seedHomepageSections();
      sections = await HomepageSection.find().sort({ display_order: 1 });
    }

    // 2. Build status mapping (true for active/on, false for inactive/off)
    const sectionStatus = {};
    const standardKeys = ["hero", "category_showcase", "featured_products", "new_arrivals", "occasion", "testimonials", "brand_story"];
    standardKeys.forEach(key => {
      sectionStatus[key] = false;
    });

    sections.forEach(sec => {
      sectionStatus[sec.section_key] = sec.is_active;
    });

    // Promise-returning tasks for each section to run in parallel
    const getHeroBanners = async () => {
      if (!sectionStatus.hero) return [];
      return Banner.find({ isActive: true })
        .populate("category", "name _id")
        .sort({ order: 1, createdAt: -1 });
    };

    const getCategoryShowcase = async () => {
      if (!sectionStatus.category_showcase) return [];
      return Category.find({ isActive: true }).limit(5);
    };

    const getFeaturedProducts = async () => {
      if (!sectionStatus.featured_products) return [];
      const featuredSection = sections.find(s => s.section_key === "featured_products");
      const displayMode = featuredSection ? featuredSection.display_mode : "featured";

      if (displayMode === "best_sellers") {
        // Aggregate top best selling products, limited to 50 to avoid loading too many
        const bestSellersAgg = await Order.aggregate([
          { $match: { paymentStatus: { $ne: "Failed" } } },
          { $unwind: "$items" },
          { $group: { _id: "$items.product", totalSold: { $sum: "$items.quantity" } } },
          { $sort: { totalSold: -1 } },
          { $limit: 50 }
        ]);

        let featured = [];
        if (bestSellersAgg.length > 0) {
          const bestSellerIds = bestSellersAgg.map(item => item._id);
          const activeSoldProducts = await Product.find({
            _id: { $in: bestSellerIds },
            isActive: true,
            isDeleted: false
          })
            .populate("category", "name")
            .lean();

          const salesMap = {};
          bestSellersAgg.forEach(item => {
            if (item._id) {
              salesMap[item._id.toString()] = item.totalSold;
            }
          });

          const soldProducts = activeSoldProducts.map(p => ({
            ...p,
            totalSold: salesMap[p._id.toString()] || 0
          }));

          // Sort sold products by sales count descending
          soldProducts.sort((a, b) => b.totalSold - a.totalSold);
          featured = soldProducts.slice(0, 10);
        }

        // Fill remaining slots if we have fewer than 10 best sellers
        if (featured.length < 10) {
          const excludeIds = featured.map(p => p._id);
          const needed = 10 - featured.length;
          if (needed > 0) {
            const randomProductsSample = await Product.aggregate([
              {
                $match: {
                  _id: { $nin: excludeIds },
                  isActive: true,
                  isDeleted: false
                }
              },
              { $sample: { size: needed } }
            ]);

            if (randomProductsSample.length > 0) {
              const randomProducts = await Product.find({
                _id: { $in: randomProductsSample.map(p => p._id) }
              })
                .populate("category", "name")
                .lean();

              featured = [...featured, ...randomProducts];
            }
          }
        }

        return featured.map(p => ({ ...p, displayMode: "best_sellers", isBestseller: true }));
      } else {
        // Default standard Featured Products (10 featured products)
        const products = await Product.find({
          isFeatured: true,
          isActive: true,
          isDeleted: false
        })
          .populate("category", "name")
          .limit(10)
          .lean();
        return products.map(p => ({ ...p, displayMode: "featured", isBestseller: false }));
      }
    };

    const getNewArrivals = async () => {
      if (!sectionStatus.new_arrivals) return [];
      const newArrivalsSection = sections.find(s => s.section_key === "new_arrivals");
      const displayMode = newArrivalsSection ? newArrivalsSection.display_mode : "new_arrivals";
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (displayMode === "best_deal") {
        // Query products with isBestDeal: true
        let products = await Product.find({
          isBestDeal: true,
          isActive: true,
          isDeleted: false
        })
          .populate("category", "name")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        // Fallback: random 10 active products using $sample if no best deal products
        if (products.length === 0) {
          const sampleProducts = await Product.aggregate([
            { $match: { isActive: true, isDeleted: false } },
            { $sample: { size: 10 } }
          ]);
          if (sampleProducts.length > 0) {
            products = await Product.find({
              _id: { $in: sampleProducts.map(p => p._id) }
            })
              .populate("category", "name")
              .lean();
          }
        }

        // Map isNew dynamically + tag as best_deal
        return products.map(p => {
          const isWithin30 = p.createdAt ? (Date.now() - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
          return {
            ...p,
            isNew: isWithin30 || p.isNew,
            displayMode: "best_deal",
            isBestDeal: true
          };
        });
      } else {
        // New Arrivals mode: isNew true or created within 30 days
        let products = await Product.find({
          $or: [
            { isNew: true },
            { createdAt: { $gte: thirtyDaysAgo } }
          ],
          isActive: true,
          isDeleted: false
        })
          .populate("category", "name")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        // Fallback: last added 10 products
        if (products.length === 0) {
          products = await Product.find({
            isActive: true,
            isDeleted: false
          })
            .populate("category", "name")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        }

        // Map isNew dynamically + tag as new_arrivals
        return products.map(p => {
          const isWithin30 = p.createdAt ? (Date.now() - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
          return {
            ...p,
            isNew: isWithin30 || p.isNew,
            displayMode: "new_arrivals",
            isBestDeal: false
          };
        });
      }
    };

    const getOccasions = async () => {
      if (!sectionStatus.occasion) return [];
      const distinctOccasions = await Product.distinct("occasion", {
        isActive: true,
        isDeleted: false
      });
      return distinctOccasions.filter(occ => occ && occ.trim() !== "");
    };

    // Execute queries in parallel
    const [heroBanners, categoryShowcase, featuredProducts, newArrivals, occasions] = await Promise.all([
      getHeroBanners(),
      getCategoryShowcase(),
      getFeaturedProducts(),
      getNewArrivals(),
      getOccasions()
    ]);

    const responsePayload = new ApiResponse(200, {
      sections: sectionStatus,
      hero: heroBanners,
      category_showcase: categoryShowcase,
      featured_products: featuredProducts,
      new_arrivals: newArrivals,
      occasion: occasions
    }, "Landing page data fetched successfully");

    landingPageCache = responsePayload;
    cacheExpiry = now + CACHE_TTL;

    res.status(200).json(responsePayload);

  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  getAllHomepageSections,
  createHomepageSection,
  toggleActiveHomepageSection,
  updateDisplayModeHomepageSection,
  getLandingPageData,
  clearLandingPageCache,
};