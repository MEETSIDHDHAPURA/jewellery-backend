const express = require("express");
const router = express.Router();
const { adminOnly } = require("../Middlewares/auth.middleware");
const categoryController = require("../Controllers/Category.controllers");

router.post("/create", adminOnly, categoryController.createCategory);
router.get("/all", categoryController.getAllCategories);
router.put("/update/:id", adminOnly, categoryController.updateCategory);
router.delete("/delete/:id", adminOnly, categoryController.deleteCategory);

module.exports = router;
