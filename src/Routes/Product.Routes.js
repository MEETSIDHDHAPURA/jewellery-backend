const express = require("express");
const router = express.Router();
const productController = require("../Controllers/Product.controllers");
const upload = require("../Middlewares/Multer.middleware");

// Create with multi-image and size chart upload
router.post(
  "/",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.createProduct
);

router.post(
  "/create",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.createProduct
);

router.get("/", productController.getAllProducts);
router.get("/all", productController.getAllProducts);

router.get("/:id", productController.getProductById);
router.get("/get/:id", productController.getProductById);

// Update with multi-image and size chart upload
router.put(
  "/:id",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.updateProduct
);

router.put(
  "/update/:id",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  productController.updateProduct
);

router.delete("/:id", productController.deleteProduct);
router.delete("/delete/:id", productController.deleteProduct);

module.exports = router;

