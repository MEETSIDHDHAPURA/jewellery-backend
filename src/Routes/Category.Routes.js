const express = require("express");
const router = express.Router();
const categoryController = require("../Controllers/Category.controllers");

router.post("/create", categoryController.createCategory);
router.get("/all", categoryController.getAllCategories);
router.put("/update/:id", categoryController.updateCategory);
router.delete("/delete/:id", categoryController.deleteCategory);

module.exports = router;
