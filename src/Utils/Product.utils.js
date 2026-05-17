/**
 * Jewellery Product Utility Functions
 */

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

/**
 * Calculates final price for frontend display
 */
const calculatePrice = (variant, diamond, makingCharge, makingChargeType, gst) => {
  let subTotal = (variant?.basePrice || 0);
  
  // Add Diamond Price
  if (diamond && diamond.additionalPrice) {
    subTotal += diamond.additionalPrice;
  }

  // Add Making Charge
  if (makingChargeType === "per_gram") {
    subTotal += (makingCharge * (variant?.weight || 0));
  } else {
    subTotal += (makingCharge || 0);
  }

  const gstAmount = subTotal * (gst / 100);
  const finalPrice = subTotal + gstAmount;

  return {
    subTotal: Math.round(subTotal),
    gstAmount: Math.round(gstAmount),
    finalPrice: Math.round(finalPrice),
  };
};

module.exports = {
  generateSKU,
  generateVariantCombinations,
  calculatePrice,
};
