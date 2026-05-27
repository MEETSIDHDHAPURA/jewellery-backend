const HomepageSection = require("../Models/LandingPage.Modal");

const seedHomepageSections = async () => {
  try {
    const defaultSections = [
      { section_key: "hero", is_active: true, display_order: 1 },
      { section_key: "category_showcase", is_active: true, display_order: 2 },
      { section_key: "featured_products", is_active: true, display_order: 3 },
      { section_key: "new_arrivals", is_active: true, display_order: 4 },
      { section_key: "occasion", is_active: true, display_order: 5 },
      { section_key: "testimonials", is_active: true, display_order: 6 },
      { section_key: "brand_story", is_active: true, display_order: 7 }
    ];

    for (const sec of defaultSections) {
      const existing = await HomepageSection.findOne({ section_key: sec.section_key });
      if (!existing) {
        await HomepageSection.create(sec);
      }
    }
    console.log("Homepage sections seeded successfully!");
  } catch (error) {
    console.error("Error seeding homepage sections:", error);
  }
};

module.exports = { seedHomepageSections };
