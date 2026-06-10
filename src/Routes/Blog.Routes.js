const express = require("express");
const router = express.Router();
const blogController = require("../Controllers/Blog.controllers");
const upload = require("../Middlewares/multer.middleware");

// Create with single image upload
router.post("/create", upload.single("image"), blogController.createBlog);

router.get("/all", blogController.getAllBlogs);
router.get("/get/:id", blogController.getBlogById);
router.delete("/delete/:id", blogController.deleteBlog);

module.exports = router;
