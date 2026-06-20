const express = require("express");
const router = express.Router();
const productController = require("../Controllers/Product.controllers");
const upload = require("../Middlewares/multer.middleware");
const { auth } = require("../Middlewares/auth.middleware");

// Create with multi-image and size chart upload
router.post(
  "/",
  auth,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.createProduct
);

router.post(
  "/create",
  auth,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.createProduct
);

router.post("/bulk", auth, productController.bulkCreateProducts);

router.get("/", productController.getAllProducts);
router.get("/all", productController.getAllProducts);
router.get("/search", productController.globalSearch);

router.get("/related/:id", productController.getRelatedProducts);

router.get("/:id", auth, productController.getProductById);
router.get("/get/:id", auth, productController.getProductById);

// Update with multi-image and size chart upload
router.put(
  "/:id",
  auth,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.updateProduct
);

router.put(
  "/update/:id",
  auth,
  upload.fields([
    { name: "images_yellowGold", maxCount: 10 },
    { name: "images_whiteGold", maxCount: 10 },
    { name: "images_roseGold", maxCount: 10 },
    { name: "images_silver", maxCount: 10 },
    { name: "images_platinum", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.updateProduct
);

router.delete("/:id", auth, productController.deleteProduct);
router.delete("/delete/:id", auth, productController.deleteProduct);

module.exports = router;

