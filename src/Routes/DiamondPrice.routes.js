const express = require("express");
const {
  createDiamondPrice,
  bulkCreateDiamondPrices,
  getDiamondPrices,
  getDiamondPriceById,
  updateDiamondPrice,
  deleteDiamondPrice,
} = require("../Controllers/DiamondPrice.controller.js");
const upload = require("../Middlewares/multer.middleware");

const router = express.Router();

router.post(
  "/",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  createDiamondPrice
);
router.post("/bulk", bulkCreateDiamondPrices);
router.get("/", getDiamondPrices);
router.get("/:id", getDiamondPriceById);
router.put(
  "/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  updateDiamondPrice
);
router.delete("/:id", deleteDiamondPrice);

module.exports = router;
