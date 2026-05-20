const express = require("express");
const {
  createDiamondPrice,
  bulkCreateDiamondPrices,
  getDiamondPrices,
  updateDiamondPrice,
  deleteDiamondPrice,
} = require("../Controllers/DiamondPrice.controller.js");

const router = express.Router();

router.post("/", createDiamondPrice);
router.post("/bulk", bulkCreateDiamondPrices);
router.get("/", getDiamondPrices);
router.put("/:id", updateDiamondPrice);
router.delete("/:id", deleteDiamondPrice);

module.exports = router;
