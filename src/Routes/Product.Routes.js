const express = require("express");
const router = express.Router();
const productController = require("../Controllers/Product.controllers");
const upload = require("../Middlewares/Multer.middleware");

// Create with multi-image upload
router.post("/create", upload.array("images", 10), productController.createProduct);

router.get("/all", productController.getAllProducts);
router.get("/get/:id", productController.getProductById);

// Update with multi-image upload
router.put("/update/:id", upload.array("images", 10), productController.updateProduct);

router.delete("/delete/:id", productController.deleteProduct);

module.exports = router;
