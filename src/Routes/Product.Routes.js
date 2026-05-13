const express = require("express");
const router = express.Router();
const productController = require("../Controllers/Product.controllers");
const upload = require("../Middlewares/Multer.middleware");

// Create with multi-image and size chart upload
router.post(
  "/create",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
  ]),
  productController.createProduct
);

router.get("/all", productController.getAllProducts);
router.get("/get/:id", productController.getProductById);

// Update with multi-image and size chart upload
router.put(
  "/update/:id",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "sizeChart", maxCount: 1 },
  ]),
  productController.updateProduct
);

router.delete("/delete/:id", productController.deleteProduct);

module.exports = router;
