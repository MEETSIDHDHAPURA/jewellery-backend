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

module.exports = {
  generateSKU,
  generateVariantCombinations,
  calculatePrice,
};
