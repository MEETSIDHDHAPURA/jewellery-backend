const express = require("express");
const router = express.Router();
const bannerController = require("../Controllers/Banner.controllers");
const upload = require("../Middlewares/Multer.middleware");

// Single media upload middleware (handles both image and video in one field called "media")
router.post("/create", upload.single("media"), bannerController.createBanner);
router.get("/all", bannerController.getAllBanners);
router.get("/get/:id", bannerController.getBannerById);
router.put("/update/:id", upload.single("media"), bannerController.updateBanner);
router.delete("/delete/:id", bannerController.deleteBanner);

module.exports = router;
