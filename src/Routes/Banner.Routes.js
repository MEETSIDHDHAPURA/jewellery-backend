const express = require("express");
const router = express.Router();
const bannerController = require("../Controllers/Banner.controllers");
const upload = require("../Middlewares/multer.middleware");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.post("/create", adminOnly, upload.single("image"), bannerController.createBanner);
router.get("/all", bannerController.getAllBanners);
router.get("/get/:id", bannerController.getBannerById);
router.put("/update/:id", adminOnly, upload.single("image"), bannerController.updateBanner);
router.put("/reorder", adminOnly, bannerController.reorderBanners);
router.delete("/delete/:id", adminOnly, bannerController.deleteBanner);

module.exports = router;
