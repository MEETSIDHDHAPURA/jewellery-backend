const express = require("express");
const { auth } = require("../Middlewares/auth.middleware");
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
  auth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  createDiamondPrice
);
router.post("/bulk", auth, bulkCreateDiamondPrices);
router.get("/", getDiamondPrices);
router.get("/:id", getDiamondPriceById);
router.put(
  "/:id",
  auth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  updateDiamondPrice
);
router.delete("/:id", auth, deleteDiamondPrice);

module.exports = router;
