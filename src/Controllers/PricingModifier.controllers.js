const PricingModifier = require("../Models/PricingModifier.Model");
const Product = require("../Models/Product.Model");
const MetalRate = require("../Models/MetalRate.Model");
const MakingCharge = require("../Models/MakingCharge.Model");
const GlobalConfig = require("../Models/GlobalConfig.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { clearProductCache } = require("./Product.controllers");
const mongoose = require("mongoose");

/**
 * Get All Pricing Modifiers (grouped by attributeType)
 */
const getAllModifiers = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category) {
      filter.category = category;
    }
    const modifiers = await PricingModifier.find(filter).sort({
      attributeType: 1,
      sortOrder: 1,
    });

    // Group by attributeType for frontend convenience
    const grouped = modifiers.reduce((acc, mod) => {
      if (!acc[mod.attributeType]) acc[mod.attributeType] = [];
      acc[mod.attributeType].push(mod);
      return acc;
    }, {});

    res
      .status(200)
      .json(
        new ApiResponse(200, grouped, "Size modifiers fetched successfully")
      );
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Get All Modifiers (flat list, including inactive)
 */
const getAllModifiersFlat = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};
    if (category) {
      filter.category = category;
    }
    const modifiers = await PricingModifier.find(filter).sort({
      attributeType: 1,
      sortOrder: 1,
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, modifiers, "All modifiers fetched successfully")
      );
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Create a Pricing Modifier
 */
const createModifier = async (req, res) => {
  try {
    const { category, attributeType, value, label, modifierType, modifierValue, sortOrder } = req.body;

    if (!category || !attributeType || !value || !label || modifierValue === undefined) {
      throw new ApiError(400, "category, attributeType, value, label, and modifierValue are required");
    }

    const modifier = await PricingModifier.create({
      category,
      attributeType,
      value,
      label,
      modifierType: modifierType || "multiplier",
      modifierValue,
      sortOrder: sortOrder || 0,
    });

    clearProductCache();
    res
      .status(201)
      .json(
        new ApiResponse(201, modifier, "Pricing modifier created successfully")
      );
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json(
          new ApiError(409, "A modifier with this category, attribute type and value already exists")
        );
    }
    res
      .status(error.statusCode || 500)
      .json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Update a Pricing Modifier
 */
const updateModifier = async (req, res) => {
  try {
    const { id } = req.params;
    const modifier = await PricingModifier.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
    });

    if (!modifier) throw new ApiError(404, "Modifier not found");

    clearProductCache();
    res
      .status(200)
      .json(
        new ApiResponse(200, modifier, "Pricing modifier updated successfully")
      );
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Delete a Pricing Modifier
 */
const deleteModifier = async (req, res) => {
  try {
    const modifier = await PricingModifier.findById(req.params.id);
    if (!modifier) throw new ApiError(404, "Modifier not found");

    if (modifier.attributeType === "size") {
      const productUsingSize = await Product.findOne({
        category: modifier.category,
        isDeleted: { $ne: true },
        allowedSizes: modifier.value,
      });

      if (productUsingSize) {
        throw new ApiError(
          400,
          "Cannot delete size modifier because it is currently assigned to a product in this category"
        );
      }
    }

    await PricingModifier.findByIdAndDelete(req.params.id);

    clearProductCache();
    res
      .status(200)
      .json(new ApiResponse(200, {}, "Pricing modifier deleted successfully"));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Seed Default Industry-Standard Modifiers
 */
const seedDefaults = async (req, res) => {
  try {
    const Category = require("../Models/Category.Model");
    const { category } = req.body;

    let targetCategories = [];
    if (category) {
      const catDoc = await Category.findById(category);
      if (!catDoc) {
        throw new ApiError(404, "Selected category not found");
      }
      targetCategories = [catDoc];
    } else {
      targetCategories = await Category.find({ isActive: true });
    }

    if (targetCategories.length === 0) {
      throw new ApiError(404, "No active categories found to seed defaults for");
    }

    let totalSeeded = 0;
    for (const cat of targetCategories) {
      const catId = cat._id.toString();
      const catName = (cat.name || "").toLowerCase();
      const isRing = catName.includes("ring");
      const isBracelet = catName.includes("bracelet");

      // Delete existing modifiers for this category to avoid mixed values (like old sizes)
      await PricingModifier.deleteMany({ category: catId });

      const dynamicDefaults = [
        // ===== CARATS (multiplier) =====
        { category: catId, attributeType: "carat", value: "0.20ct", label: "0.20 Carat", modifierType: "multiplier", modifierValue: 1.0, sortOrder: 1 },
        { category: catId, attributeType: "carat", value: "0.30ct", label: "0.30 Carat", modifierType: "multiplier", modifierValue: 1.8, sortOrder: 2 },
        { category: catId, attributeType: "carat", value: "0.50ct", label: "0.50 Carat", modifierType: "multiplier", modifierValue: 3.2, sortOrder: 3 },
        { category: catId, attributeType: "carat", value: "0.70ct", label: "0.70 Carat", modifierType: "multiplier", modifierValue: 5.5, sortOrder: 4 },
        { category: catId, attributeType: "carat", value: "1.00ct", label: "1.00 Carat", modifierType: "multiplier", modifierValue: 8.5, sortOrder: 5 },
        { category: catId, attributeType: "carat", value: "1.50ct", label: "1.50 Carat", modifierType: "multiplier", modifierValue: 18.0, sortOrder: 6 },
        { category: catId, attributeType: "carat", value: "2.00ct", label: "2.00 Carat", modifierType: "multiplier", modifierValue: 32.0, sortOrder: 7 },

        // ===== CLARITY (flat_add - $5 reduction per step from IF) =====
        { category: catId, attributeType: "clarity", value: "IF", label: "IF (Internally Flawless)", modifierType: "flat_add", modifierValue: 0, sortOrder: 1 },
        { category: catId, attributeType: "clarity", value: "VVS1", label: "VVS1", modifierType: "flat_add", modifierValue: -5, sortOrder: 2 },
        { category: catId, attributeType: "clarity", value: "VVS2", label: "VVS2", modifierType: "flat_add", modifierValue: -10, sortOrder: 3 },
        { category: catId, attributeType: "clarity", value: "VS1", label: "VS1", modifierType: "flat_add", modifierValue: -15, sortOrder: 4 },
        { category: catId, attributeType: "clarity", value: "VS2", label: "VS2", modifierType: "flat_add", modifierValue: -20, sortOrder: 5 },
        { category: catId, attributeType: "clarity", value: "SI1", label: "SI1", modifierType: "flat_add", modifierValue: -25, sortOrder: 6 },
        { category: catId, attributeType: "clarity", value: "SI2", label: "SI2", modifierType: "flat_add", modifierValue: -30, sortOrder: 7 },

        // ===== COLOR (flat_add - $5 reduction per step from D) =====
        { category: catId, attributeType: "color", value: "D", label: "D (Colorless)", modifierType: "flat_add", modifierValue: 0, sortOrder: 1 },
        { category: catId, attributeType: "color", value: "E", label: "E (Colorless)", modifierType: "flat_add", modifierValue: -5, sortOrder: 2 },
        { category: catId, attributeType: "color", value: "F", label: "F (Colorless)", modifierType: "flat_add", modifierValue: -10, sortOrder: 3 },
        { category: catId, attributeType: "color", value: "G", label: "G (Near Colorless)", modifierType: "flat_add", modifierValue: -15, sortOrder: 4 },
        { category: catId, attributeType: "color", value: "H", label: "H (Near Colorless)", modifierType: "flat_add", modifierValue: -20, sortOrder: 5 },
        { category: catId, attributeType: "color", value: "I", label: "I (Near Colorless)", modifierType: "flat_add", modifierValue: -25, sortOrder: 6 },
        { category: catId, attributeType: "color", value: "J", label: "J (Near Colorless)", modifierType: "flat_add", modifierValue: -30, sortOrder: 7 },
      ];

      if (isRing) {
        dynamicDefaults.push(
          { category: catId, attributeType: "size", value: "4", label: "Size 4", modifierType: "flat_add", modifierValue: 0, sortOrder: 1 },
          { category: catId, attributeType: "size", value: "4.5", label: "Size 4.5", modifierType: "flat_add", modifierValue: 0, sortOrder: 2 },
          { category: catId, attributeType: "size", value: "5", label: "Size 5", modifierType: "flat_add", modifierValue: 0, sortOrder: 3 },
          { category: catId, attributeType: "size", value: "5.5", label: "Size 5.5", modifierType: "flat_add", modifierValue: 0, sortOrder: 4 },
          { category: catId, attributeType: "size", value: "6", label: "Size 6", modifierType: "flat_add", modifierValue: 0, sortOrder: 5 },
          { category: catId, attributeType: "size", value: "6.5", label: "Size 6.5", modifierType: "flat_add", modifierValue: 0, sortOrder: 6 },
          { category: catId, attributeType: "size", value: "7", label: "Size 7", modifierType: "flat_add", modifierValue: 0, sortOrder: 7 },
          { category: catId, attributeType: "size", value: "7.5", label: "Size 7.5", modifierType: "flat_add", modifierValue: 0, sortOrder: 8 },
          { category: catId, attributeType: "size", value: "8", label: "Size 8", modifierType: "flat_add", modifierValue: 0, sortOrder: 9 },
          { category: catId, attributeType: "size", value: "8.5", label: "Size 8.5", modifierType: "flat_add", modifierValue: 200, sortOrder: 10 },
          { category: catId, attributeType: "size", value: "9", label: "Size 9", modifierType: "flat_add", modifierValue: 300, sortOrder: 11 },
          { category: catId, attributeType: "size", value: "9.5", label: "Size 9.5", modifierType: "flat_add", modifierValue: 500, sortOrder: 12 },
          { category: catId, attributeType: "size", value: "10", label: "Size 10", modifierType: "flat_add", modifierValue: 500, sortOrder: 13 }
        );
      } else if (isBracelet) {
        for (let size = 5; size <= 14; size++) {
          dynamicDefaults.push({
            category: catId,
            attributeType: "size",
            value: `${size} in`,
            label: `${size} in`,
            modifierType: "flat_add",
            modifierValue: 0,
            sortOrder: size - 4
          });
        }
      } else {
        dynamicDefaults.push(
          { category: catId, attributeType: "size", value: "Extra small (xs)", label: "Extra small (xs)", modifierType: "flat_add", modifierValue: 0, sortOrder: 1 },
          { category: catId, attributeType: "size", value: "small (s)", label: "small (s)", modifierType: "flat_add", modifierValue: 0, sortOrder: 2 },
          { category: catId, attributeType: "size", value: "medium (m)", label: "medium (m)", modifierType: "flat_add", modifierValue: 0, sortOrder: 3 },
          { category: catId, attributeType: "size", value: "large (l)", label: "large (l)", modifierType: "flat_add", modifierValue: 0, sortOrder: 4 },
          { category: catId, attributeType: "size", value: "Extra large (xl)", label: "Extra large (xl)", modifierType: "flat_add", modifierValue: 0, sortOrder: 5 }
        );
      }

      await PricingModifier.insertMany(dynamicDefaults);
      totalSeeded += dynamicDefaults.length;
    }

    clearProductCache();
    res
      .status(200)
      .json(
        new ApiResponse(200, { count: totalSeeded }, `${totalSeeded} default modifiers seeded successfully`)
      );
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(new ApiError(error.statusCode || 500, error.message));
  }
};

/**
 * Helper to parse metal selection
 */
const parseMetalSelection = (value) => {
  const val = (value || "").toLowerCase();
  if (val.includes("silver")) {
    return { purity: "925", metal: "Silver" };
  }
  if (val.includes("platinum")) {
    return { purity: "PT950", metal: "Platinum" };
  }

  // Gold cases
  const purities = ["10K", "14K", "18K", "20K", "22K", "24K"];
  const purity = purities.find(p => value.includes(p)) || "18K";

  let metal = "Yellow Gold";
  if (val.includes("white")) {
    metal = "White Gold";
  } else if (val.includes("rose")) {
    metal = "Rose Gold";
  }

  return { purity, metal };
};

/**
 * Calculate Price - BOM-based validation endpoint
 */
const calculatePrice = async (req, res) => {
  try {
    const {
      basePrice,
      silverBasePrice,
      weight,
      weight10K,
      weight14K,
      weight18K,
      weight22K,
      weightSilver,
      weightPlatinum,
      selections,
      productId
    } = req.body;
    // selections = { metal: "18K White Gold", carat: "1.00ct", clarity: "VS1", color: "G", size: "7" }

    if (!selections) {
      throw new ApiError(400, "selections is required");
    }

    let prod = null;
    let categoryId = req.body.category;
    if (productId) {
      prod = await Product.findById(productId);
      if (prod) {
        categoryId = prod.category;
      }
    }

    const isValidCategory = categoryId && mongoose.Types.ObjectId.isValid(categoryId);

    const pBasePrice = prod ? (prod.basePrice || 0) : (Number(basePrice) || 0);
    const pSilverBasePrice = prod ? (prod.silverBasePrice || 0) : (Number(silverBasePrice) || 0);

    const selectedMetalVal = selections.metal || "";
    const isSilver = selectedMetalVal.toLowerCase().includes("silver");
    const isPlatinum = selectedMetalVal.toLowerCase().includes("platinum");

    let pWeight = 0;
    if (selectedMetalVal) {
      if (isSilver) {
        pWeight = prod ? (prod.weightSilver || 0) : (Number(weightSilver) || 0);
      } else if (isPlatinum) {
        pWeight = prod ? (prod.weightPlatinum || 0) : (Number(weightPlatinum) || 0);
      } else {
        const parsed = parseMetalSelection(selectedMetalVal);
        const purity = parsed.purity || "18K";
        if (purity === "10K") {
          pWeight = prod ? (prod.weight10K || 0) : (Number(weight10K) || 0);
        } else if (purity === "14K") {
          pWeight = prod ? (prod.weight14K || 0) : (Number(weight14K) || 0);
        } else if (purity === "18K") {
          pWeight = prod ? (prod.weight18K || 0) : (Number(weight18K) || 0);
        } else if (purity === "22K") {
          pWeight = prod ? (prod.weight22K || 0) : (Number(weight22K) || 0);
        } else {
          pWeight = prod ? (prod.weight || 0) : (Number(weight) || 0);
        }
      }
    } else {
      pWeight = prod ? (prod.weight || 0) : (Number(weight) || 0);
    }

    const gstPercentage = prod ? (prod.gstPercentage || 3) : (Number(req.body.gstPercentage) || 3);
    const diamondOptions = prod ? (prod.diamondOptions || []) : (req.body.diamondOptions || []);

    // 1. Calculate Metal Cost
    let metalPricePerGram = 0;
    if (selectedMetalVal) {
      const parsed = parseMetalSelection(selectedMetalVal);
      const metalRateDoc = await MetalRate.findOne({
        metal: parsed.metal,
        purity: parsed.purity
      });

      if (metalRateDoc) {
        metalPricePerGram = metalRateDoc.pricePerGram;
      } else {
        // Fallback pricing if rate doc not in db yet
        if (isSilver) metalPricePerGram = 80;
        else if (isPlatinum) metalPricePerGram = 4000;
        else {
          if (parsed.purity === "24K") metalPricePerGram = 7500;
          else if (parsed.purity === "22K") metalPricePerGram = 6875;
          else if (parsed.purity === "18K") metalPricePerGram = 5625;
          else if (parsed.purity === "14K") metalPricePerGram = 4375;
          else metalPricePerGram = 3125;
        }
      }
    }
    const metalCost = pWeight * metalPricePerGram;

    // 2. Calculate Making Cost - fetched from MakingCharge collection
    let makingCostRate = 0;
    if (selectedMetalVal) {
      let searchMetal = "Yellow Gold";
      if (isSilver) searchMetal = "Silver";
      else if (isPlatinum) searchMetal = "Platinum";
      else if (selectedMetalVal.toLowerCase().includes("white")) searchMetal = "White Gold";
      else if (selectedMetalVal.toLowerCase().includes("rose")) searchMetal = "Rose Gold";
      else searchMetal = "Yellow Gold";

      const mcDoc = await MakingCharge.findOne({ metal: searchMetal });
      if (mcDoc) makingCostRate = mcDoc.value || 0;
    }
    const makingCost = pWeight * makingCostRate;

    // 3. Calculate Diamond Base Cost (match by CARAT only - color/clarity handled via modifiers)
    let diamondCost = 0;
    const selectedCarat = selections.carat || "";
    const selectedClarity = selections.clarity || "";
    const selectedColor = selections.color || "";

    if (selectedCarat) {
      const matchedOpt = diamondOptions.find(opt => {
        const optCaratNum = parseFloat(opt.carat);
        const selCaratNum = parseFloat(selectedCarat);
        return !isNaN(optCaratNum) && !isNaN(selCaratNum) && optCaratNum === selCaratNum;
      });

      if (matchedOpt) {
        diamondCost = matchedOpt.additionalPrice || 0;
      }
    }

    // 4. Calculate Color flat modifier
    let colorModifier = 0;
    if (selectedColor && isValidCategory) {
      const modifier = await PricingModifier.findOne({
        category: categoryId,
        attributeType: "color",
        value: selectedColor,
        isActive: true,
      });
      if (modifier && modifier.modifierType === "flat_add") {
        colorModifier = modifier.modifierValue;
      }
    }

    // 5. Calculate Clarity flat modifier
    let clarityModifier = 0;
    if (selectedClarity && isValidCategory) {
      const modifier = await PricingModifier.findOne({
        category: categoryId,
        attributeType: "clarity",
        value: selectedClarity,
        isActive: true,
      });
      if (modifier && modifier.modifierType === "flat_add") {
        clarityModifier = modifier.modifierValue;
      }
    }

    // 6. Calculate Size flat modifier
    let sizeModifier = 0;
    if (selections.size && isValidCategory) {
      const modifier = await PricingModifier.findOne({
        category: categoryId,
        attributeType: "size",
        value: selections.size,
        isActive: true,
      });
      if (modifier && modifier.modifierType === "flat_add") {
        sizeModifier = modifier.modifierValue;
      }
    }

    // 7. Compute totals
    const subTotal = metalCost + makingCost + diamondCost + colorModifier + clarityModifier + sizeModifier;

    const marginConfig = await GlobalConfig.findOne({ key: "margin_percentage" });
    const margin = marginConfig ? marginConfig.value : 0;
    const marginAmount = subTotal * (margin / 100);

    const finalPrice = subTotal + marginAmount;
    const gstAmount = finalPrice * (gstPercentage / 100);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          metalCost: Math.round(metalCost),
          makingCost: Math.round(makingCost),
          diamondCost: Math.round(diamondCost),
          colorAdjustment: Math.round(colorModifier),
          clarityAdjustment: Math.round(clarityModifier),
          sizeCost: Math.round(sizeModifier),
          subTotal: Math.round(subTotal),
          margin: margin,
          marginAmount: Math.round(marginAmount),
          gstAmount: Math.round(gstAmount),
          finalPrice: Math.round(finalPrice),
          selections
        },
        "Price calculated successfully using BOM approach"
      )
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  getAllModifiers,
  getAllModifiersFlat,
  createModifier,
  updateModifier,
  deleteModifier,
  seedDefaults,
  calculatePrice,
};
