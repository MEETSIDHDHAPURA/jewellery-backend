/**
 * Jewellery Product Utility Functions
 */

const Product = require("../Models/Product.Model");
const MetalRate = require("../Models/MetalRate.Model");
const MakingCharge = require("../Models/MakingCharge.Model");
const PricingModifier = require("../Models/PricingModifier.Model");
const GlobalConfig = require("../Models/GlobalConfig.Model");
const DiamondPrice = require("../Models/DiamondPrice.Model");

/**
 * Generates SKU for a jewellery product variant
 */
const generateSKU = (productTitle, metal, purity, size) => {
  const prefix = productTitle.substring(0, 3).toUpperCase();
  const metalCode = metal.substring(0, 2).toUpperCase();
  const purityCode = purity.toString().toUpperCase();
  const sizeCode = size ? size.toString().toUpperCase() : "NA";
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${metalCode}${purityCode}-${sizeCode}-${random}`;
};

/**
 * Generates all possible variant combinations
 */
const generateVariantCombinations = (productId, productTitle, config) => {
  const { metals, purities, sizes, sizeType, baseWeight, basePrice } = config;
  const variants = [];

  for (const metal of metals) {
    for (const purity of purities) {
      if (sizes && sizes.length > 0) {
        for (const sizeValue of sizes) {
          variants.push({
            productId,
            metal,
            purity,
            sizeType,
            sizeValue: sizeValue.toString(),
            weight: baseWeight || 0,
            basePrice: basePrice || 0,
            sku: generateSKU(productTitle, metal, purity, sizeValue),
            stock: 0,
          });
        }
      } else {
        variants.push({
          productId,
          metal,
          purity,
          sizeType: "none",
          weight: baseWeight || 0,
          basePrice: basePrice || 0,
          sku: generateSKU(productTitle, metal, purity, "NA"),
          stock: 0,
        });
      }
    }
  }
  return variants;
};

const calculatePrice = (variant, diamond, metalRate, makingCharge, makingChargeType, gst) => {
  const metalCost = (variant?.weight || 0) * (metalRate || 0);
  const makingCost = (variant?.weight || 0) * (makingCharge || 0);
  const diamondCost = (diamond?.additionalPrice || 0);
  
  const subTotal = metalCost + makingCost + diamondCost;
  const gstAmount = subTotal * ((gst || 3) / 100);
  const finalPrice = subTotal + gstAmount;

  return {
    metalCost: Math.round(metalCost),
    makingCost: Math.round(makingCost),
    diamondCost: Math.round(diamondCost),
    subTotal: Math.round(subTotal),
    gstAmount: Math.round(gstAmount),
    finalPrice: Math.round(finalPrice),
  };
};

/**
 * Identify product's metal type category
 */
const getProductMetalType = (product) => {
  const primaryMetal = product.allowedMetals && product.allowedMetals[0] ? product.allowedMetals[0].toLowerCase() : "";
  if (primaryMetal.includes("silver")) return "Silver";
  if (primaryMetal.includes("platinum")) return "Platinum";
  if (primaryMetal.includes("white")) return "White Gold";
  if (primaryMetal.includes("rose")) return "Rose Gold";
  if (primaryMetal.includes("yellow") || primaryMetal.includes("gold")) return "Yellow Gold";
  return "";
};

/**
 * Bulk recalculation engine for product base listing price and discounted price.
 * Follows: Product Price = (Metal Rate x Weight) + Making Charges + Diamond Cost + Surcharges + Margin%
 */
const recalculateAndSavePrices = async (filterMetals = null) => {
  try {
    // 1. Fetch global margin percentage
    const marginConfig = await GlobalConfig.findOne({ key: "margin_percentage" });
    const margin = marginConfig ? marginConfig.value : 0;

    // 2. Fetch all active base products
    const query = { isDeleted: false };
    const products = await Product.find(query);

    // 3. Filter products if filterMetals is specified
    const affectedProducts = filterMetals 
      ? products.filter(p => filterMetals.includes(getProductMetalType(p)))
      : products;

    // 4. Recalculate price for each product
    for (const product of affectedProducts) {
      const selectedMetalVal = product.allowedMetals && product.allowedMetals[0] ? product.allowedMetals[0] : "";
      const isSilver = selectedMetalVal.toLowerCase().includes("silver");
      const isPlatinum = selectedMetalVal.toLowerCase().includes("platinum");

      // 4.1. Determine activeWeight
      let activeWeight = 0;
      if (selectedMetalVal) {
        if (isSilver) {
          activeWeight = product.weightSilver || 0;
        } else if (isPlatinum) {
          activeWeight = product.weightPlatinum || 0;
        } else {
          const purities = ["10K", "14K", "18K", "20K", "22K", "24K"];
          const searchPurity = purities.find(p => selectedMetalVal.includes(p)) || "18K";
          if (searchPurity === "10K") activeWeight = product.weight10K || 0;
          else if (searchPurity === "14K") activeWeight = product.weight14K || 0;
          else if (searchPurity === "18K") activeWeight = product.weight18K || 0;
          else if (searchPurity === "22K") activeWeight = product.weight22K || 0;
          else activeWeight = product.weight || 0;
        }
      } else {
        activeWeight = product.weight || 0;
      }

      // 4.2. Get Metal price per gram
      let metalPricePerGram = 0;
      if (selectedMetalVal) {
        let searchPurity = "18K";
        let searchMetal = "Yellow Gold";

        if (isSilver) {
          searchPurity = "925";
          searchMetal = "Silver";
        } else if (isPlatinum) {
          searchPurity = "PT950";
          searchMetal = "Platinum";
        } else {
          const purities = ["10K", "14K", "18K", "20K", "22K", "24K"];
          searchPurity = purities.find(p => selectedMetalVal.includes(p)) || "18K";

          if (selectedMetalVal.toLowerCase().includes("white")) {
            searchMetal = "White Gold";
          } else if (selectedMetalVal.toLowerCase().includes("rose")) {
            searchMetal = "Rose Gold";
          } else {
            searchMetal = "Yellow Gold";
          }
        }

        const rateDoc = await MetalRate.findOne({ metal: searchMetal, purity: searchPurity });
        if (rateDoc) {
          metalPricePerGram = rateDoc.pricePerGram || 0;
        } else {
          // Fallback pricing
          if (isSilver) metalPricePerGram = 80;
          else if (isPlatinum) metalPricePerGram = 4000;
          else {
            if (searchPurity === "24K") metalPricePerGram = 7500;
            else if (searchPurity === "22K") metalPricePerGram = 6875;
            else if (searchPurity === "18K") metalPricePerGram = 5625;
            else if (searchPurity === "14K") metalPricePerGram = 4375;
            else metalPricePerGram = 3125;
          }
        }
      }
      const metalCost = activeWeight * metalPricePerGram;

      // 4.3. Get Making charge rate
      let makingRate = 0;
      if (selectedMetalVal) {
        let searchMetal = "Yellow Gold";
        if (isSilver) searchMetal = "Silver";
        else if (isPlatinum) searchMetal = "Platinum";
        else if (selectedMetalVal.toLowerCase().includes("white")) searchMetal = "White Gold";
        else if (selectedMetalVal.toLowerCase().includes("rose")) searchMetal = "Rose Gold";
        else searchMetal = "Yellow Gold";

        const mcDoc = await MakingCharge.findOne({ metal: searchMetal });
        if (mcDoc) makingRate = mcDoc.value || 0;
      }
      const makingCost = activeWeight * makingRate;

      // 4.4. Get Diamond cost (Dynamic fetch first, fallback to product.diamondOptions)
      let diamondCost = 0;
      const selectedCarat = product.allowedCarats && product.allowedCarats[0] ? product.allowedCarats[0] : "";
      const selectedClarity = product.allowedClarities && product.allowedClarities[0] ? product.allowedClarities[0] : "";
      const selectedColor = product.allowedColors && product.allowedColors[0] ? product.allowedColors[0] : "";

      if (selectedCarat && selectedClarity && selectedColor) {
        const shapes = ["Round", "Oval", "Cushion", "Princess", "Pear", "Radiant", "Emerald", "Marquise", "Heart", "Asscher"];
        const shape = shapes.find(s => product.title.toLowerCase().includes(s.toLowerCase())) || "Round";

        const diamondDoc = await DiamondPrice.findOne({
          carat: Number(selectedCarat) || parseFloat(selectedCarat),
          clarity: selectedClarity,
          color: selectedColor,
          shape: shape
        });

        if (diamondDoc) {
          diamondCost = diamondDoc.price || 0;
        }
      }

      if (diamondCost === 0 && selectedCarat && product.diamondOptions && product.diamondOptions.length > 0) {
        const matchedOpt = product.diamondOptions.find(opt => {
          const optCaratNum = parseFloat(opt.carat);
          const selCaratNum = parseFloat(selectedCarat);
          return !isNaN(optCaratNum) && !isNaN(selCaratNum) && optCaratNum === selCaratNum;
        });
        if (matchedOpt) {
          diamondCost = matchedOpt.additionalPrice || 0;
        }
      }

      // 4.5. Get Modifiers
      let colorModifier = 0;
      if (selectedColor) {
        const modifier = await PricingModifier.findOne({
          category: product.category,
          attributeType: "color",
          value: selectedColor,
          isActive: true,
        });
        if (modifier && modifier.modifierType === "flat_add") {
          colorModifier = modifier.modifierValue;
        }
      }

      let clarityModifier = 0;
      if (selectedClarity) {
        const modifier = await PricingModifier.findOne({
          category: product.category,
          attributeType: "clarity",
          value: selectedClarity,
          isActive: true,
        });
        if (modifier && modifier.modifierType === "flat_add") {
          clarityModifier = modifier.modifierValue;
        }
      }

      let sizeModifier = 0;
      const selectedSize = product.allowedSizes && product.allowedSizes[0] ? product.allowedSizes[0] : "";
      if (selectedSize) {
        const modifier = await PricingModifier.findOne({
          category: product.category,
          attributeType: "size",
          value: selectedSize,
          isActive: true,
        });
        if (modifier && modifier.modifierType === "flat_add") {
          sizeModifier = modifier.modifierValue;
        }
      }

      // 4.6. Compute final base price and discounted price
      const subTotal = metalCost + makingCost + diamondCost + colorModifier + clarityModifier + sizeModifier;
      const marginAmount = subTotal * (margin / 100);
      const newPrice = Math.round(subTotal + marginAmount);
      const discountPercent = product.discountPercentage || 0;
      const newDiscountedPrice = Math.round(newPrice * (1 - discountPercent / 100));

      // 4.7. Save to database
      product.Price = newPrice;
      product.discountedPrice = newDiscountedPrice;
      await product.save();
    }
  } catch (error) {
    console.error("Error in recalculateAndSavePrices:", error);
  }
};

module.exports = {
  generateSKU,
  generateVariantCombinations,
  calculatePrice,
  getProductMetalType,
  recalculateAndSavePrices,
};
