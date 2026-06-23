const express = require("express");
const { adminOnly } = require("../Middlewares/auth.middleware");
const {
  createDiamondPrice,
  bulkCreateDiamondPrices,
  getDiamondPrices,
  getDiamondPriceById,
  updateDiamondPrice,
  deleteDiamondPrice,
  getRelatedDiamonds,
} = require("../Controllers/DiamondPrice.controller.js");
const upload = require("../Middlewares/multer.middleware");

const router = express.Router();

router.post(
  "/",
  adminOnly,
  upload.fields([
    { name: "image", maxCount: 10 },
    { name: "certificate", maxCount: 1 },
  ]),
  createDiamondPrice
);
router.post("/bulk", adminOnly, bulkCreateDiamondPrices);
router.get("/", getDiamondPrices);
router.get("/:id", getDiamondPriceById);
router.get("/:id/related", getRelatedDiamonds);
router.put(
  "/:id",
  adminOnly,
  upload.fields([
    { name: "image", maxCount: 10 },
    { name: "certificate", maxCount: 1 },
  ]),
  updateDiamondPrice
);
router.delete("/:id", adminOnly, deleteDiamondPrice);

module.exports = router;
