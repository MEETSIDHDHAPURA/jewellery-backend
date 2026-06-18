const express = require("express");
const router = express.Router();
const bannerController = require("../Controllers/Banner.controllers");
const upload = require("../Middlewares/multer.middleware");
const { auth } = require("../Middlewares/auth.middleware");

router.post("/create", auth, upload.single("image"), bannerController.createBanner);
router.get("/all", bannerController.getAllBanners);
router.get("/get/:id", bannerController.getBannerById);
router.put("/update/:id", auth, upload.single("image"), bannerController.updateBanner);
router.put("/reorder", auth, bannerController.reorderBanners);
router.delete("/delete/:id", auth, bannerController.deleteBanner);

module.exports = router;
