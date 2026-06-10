const express = require("express");
const router = express.Router();
const bannerController = require("../Controllers/Banner.controllers");
const upload = require("../Middlewares/multer.middleware");

router.post("/create", upload.single("image"), bannerController.createBanner);
router.get("/all", bannerController.getAllBanners);
router.get("/get/:id", bannerController.getBannerById);
router.put("/update/:id", upload.single("image"), bannerController.updateBanner);
router.put("/reorder", bannerController.reorderBanners);
router.delete("/delete/:id", bannerController.deleteBanner);

module.exports = router;

