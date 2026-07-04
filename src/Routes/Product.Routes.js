const express = require("express");
const router = express.Router();
const productController = require("../Controllers/Product.controllers");
const upload = require("../Middlewares/multer.middleware");
const { adminOnly } = require("../Middlewares/auth.middleware");

// Create with multi-image and size chart upload
router.post(
  "/",
  adminOnly,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 10 },
  ]),
  productController.createProduct
);

router.post(
  "/create",
  adminOnly,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 10 },
  ]),
  productController.createProduct
);

router.post("/upload-media", adminOnly, upload.any(), productController.uploadProductMedia);

router.get("/", productController.getAllProducts);
router.get("/all", productController.getAllProducts);
router.get("/search", productController.globalSearch);
router.post("/validate-guest-items", productController.validateGuestItems);

router.get("/related/:id", productController.getRelatedProducts);

router.get("/:id", productController.getProductById);
router.get("/get/:id", productController.getProductById);

// Update with multi-image and size chart upload
router.put(
  "/:id",
  adminOnly,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 10 },
  ]),
  productController.updateProduct
);

router.put(
  "/update/:id",
  adminOnly,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 10 },
  ]),
  productController.updateProduct
);

router.delete("/:id", adminOnly, productController.deleteProduct);
router.delete("/delete/:id", adminOnly, productController.deleteProduct);

module.exports = router;

