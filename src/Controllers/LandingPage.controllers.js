const HomepageSection = require("../Models/LandingPage.Modal");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Get all sections with status (self-healing/seeding if empty)
const getAllHomepageSections = async (req, res) => {
  try {
    let sections = await HomepageSection.find();
    if (sections.length === 0) {
      const { seedHomepageSections } = require("../Utils/HomepageSectionSeeder");
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
      if (displayMode !== "new_arrivals" && displayMode !== "trending") {
        throw new ApiError(400, "For new_arrivals, display_mode must be 'new_arrivals' or 'trending'");
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

module.exports = {
  getAllHomepageSections,
  createHomepageSection,
  toggleActiveHomepageSection,
  updateDisplayModeHomepageSection,
};
