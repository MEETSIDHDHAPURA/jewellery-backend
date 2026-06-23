const express = require("express");
const router = express.Router();
const blogController = require("../Controllers/Blog.controllers");
const upload = require("../Middlewares/multer.middleware");
const { adminOnly } = require("../Middlewares/auth.middleware");

// Create with single image upload
router.post("/create", adminOnly, upload.single("image"), blogController.createBlog);

router.get("/all", blogController.getAllBlogs);
router.get("/get/:id", blogController.getBlogById);
router.delete("/delete/:id", adminOnly, blogController.deleteBlog);

module.exports = router;
