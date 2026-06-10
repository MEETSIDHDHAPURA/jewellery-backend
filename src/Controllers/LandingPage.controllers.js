const HomepageSection = require("../Models/LandingPage.Modal");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { seedHomepageSections } = require("../Utils/HomepageSectionSeeder");
const Banner = require("../Models/Banner.Model");
const Category = require("../Models/Category.Model");
const Product = require("../Models/Product.Model");
const Order = require("../Models/Order.Model");


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

    res.status(201).json(new ApiResponse(201, section, "Homepage section created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

const getLandingPageData = async (req, res) => {
  try {
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

    // 3. Query banner data if hero section is active
    let heroBanners = [];
    if (sectionStatus.hero) {
      heroBanners = await Banner.find({ isActive: true }).populate("category", "name _id").sort({ order: 1, createdAt: -1 });
    }

    // 4. Query category data if showcase is active
    let categoryShowcase = [];
    if (sectionStatus.category_showcase) {
      categoryShowcase = await Category.find({ isActive: true }).limit(5);
    }

    // 5. Query featured products / best sellers
    let featuredProducts = [];
    if (sectionStatus.featured_products) {
      const featuredSection = sections.find(s => s.section_key === "featured_products");
      const displayMode = featuredSection ? featuredSection.display_mode : "featured";

      if (displayMode === "best_sellers") {
        // Query best sellers logic based on orders
        const bestSellersAgg = await Order.aggregate([
          { $match: { paymentStatus: { $ne: "Failed" } } },
          { $unwind: "$items" },
          { $group: { _id: "$items.product", totalSold: { $sum: "$items.quantity" } } },
          { $sort: { totalSold: -1 } }
        ]);

        const activeProducts = await Product.find({ isActive: true, isDeleted: false })
          .populate("category", "name")
          .lean();

        const shuffleArray = (array) => {
          const arr = [...array];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        };

        if (bestSellersAgg.length === 0) {
          featuredProducts = shuffleArray(activeProducts).slice(0, 10);
        } else {
          const salesMap = {};
          bestSellersAgg.forEach(item => {
            if (item._id) {
              salesMap[item._id.toString()] = item.totalSold;
            }
          });

          const soldProducts = [];
          const unsoldProducts = [];

          activeProducts.forEach(p => {
            const sales = salesMap[p._id.toString()] || 0;
            if (sales > 0) {
              soldProducts.push({ ...p, totalSold: sales });
            } else {
              unsoldProducts.push(p);
            }
          });

          // Sort sold products by sales count descending (sequence according to order count)
          soldProducts.sort((a, b) => b.totalSold - a.totalSold);

          // Randomize unsold products to keep display organic and premium
          const shuffledUnsold = shuffleArray(unsoldProducts);

          // Place sold products first, followed by random unsold products to fill layout (limit to 10)
          featuredProducts = [...soldProducts, ...shuffledUnsold].slice(0, 10);
        }
        featuredProducts = featuredProducts.map(p => ({ ...p, displayMode: "best_sellers", isBestseller: true }));
      } else {
        // Default standard Featured Products (10 featured products)
        featuredProducts = await Product.find({
          isFeatured: true,
          isActive: true,
          isDeleted: false
        })
          .populate("category", "name")
          .limit(10)
          .lean();
        featuredProducts = featuredProducts.map(p => ({ ...p, displayMode: "featured", isBestseller: false }));
      }
    }


    // 6. Query new arrivals / best deals
    let newArrivals = [];
    if (sectionStatus.new_arrivals) {
      const newArrivalsSection = sections.find(s => s.section_key === "new_arrivals");
      const displayMode = newArrivalsSection ? newArrivalsSection.display_mode : "new_arrivals";
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (displayMode === "best_deal") {
        // Query products with isBestDeal: true
        newArrivals = await Product.find({
          isBestDeal: true,
          isActive: true,
          isDeleted: false
        })
          .populate("category", "name")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        // Fallback: random 10 active products if no best deal products
        if (newArrivals.length === 0) {
          const allActive = await Product.find({ isActive: true, isDeleted: false })
            .populate("category", "name")
            .lean();
          for (let i = allActive.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allActive[i], allActive[j]] = [allActive[j], allActive[i]];
          }
          newArrivals = allActive.slice(0, 10);
        }

        // Map isNew dynamically + tag as best_deal
        newArrivals = newArrivals.map(p => {
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
        newArrivals = await Product.find({
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
        if (newArrivals.length === 0) {
          newArrivals = await Product.find({
            isActive: true,
            isDeleted: false
          })
            .populate("category", "name")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        }

        // Map isNew dynamically + tag as new_arrivals
        newArrivals = newArrivals.map(p => {
          const isWithin30 = p.createdAt ? (Date.now() - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
          return {
            ...p,
            isNew: isWithin30 || p.isNew,
            displayMode: "new_arrivals",
            isBestDeal: false
          };
        });
      }
    }

    // 7. Query active unique occasions
    let occasions = [];
    if (sectionStatus.occasion) {
      occasions = await Product.distinct("occasion", {
        isActive: true,
        isDeleted: false
      });
      occasions = occasions.filter(occ => occ && occ.trim() !== "");
    }

    res.status(200).json(new ApiResponse(200, {
      sections: sectionStatus,
      hero: heroBanners,
      category_showcase: categoryShowcase,
      featured_products: featuredProducts,
      new_arrivals: newArrivals,
      occasion: occasions
    }, "Landing page data fetched successfully"));

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
};