const express = require("express");
const router = express.Router();
const { auth } = require("../Middlewares/auth.middleware");
const categoryController = require("../Controllers/Category.controllers");

router.post("/create", auth, categoryController.createCategory);
router.get("/all", categoryController.getAllCategories);
router.put("/update/:id", auth, categoryController.updateCategory);
router.delete("/delete/:id", auth, categoryController.deleteCategory);

module.exports = router;
