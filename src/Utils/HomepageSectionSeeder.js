const HomepageSection = require("../Models/LandingPage.Modal");

const seedHomepageSections = async () => {
  const defaultSections = [
    { section_key: "shop_by_category", is_active: true, display_mode: null },
    { section_key: "hero_banner", is_active: true, display_mode: null },
    { section_key: "featured_products", is_active: true, display_mode: "featured" },
    { section_key: "our_story", is_active: true, display_mode: null },
    { section_key: "new_arrivals", is_active: true, display_mode: "new_arrivals" },
    { section_key: "shop_by_occasion", is_active: true, display_mode: null },
    { section_key: "faqs", is_active: true, display_mode: null }
  ];

  for (const section of defaultSections) {
    await HomepageSection.findOneAndUpdate(
      { section_key: section.section_key },
      section,
      { upsert: true, new: true }
    );
  }
};

module.exports = { seedHomepageSections };
