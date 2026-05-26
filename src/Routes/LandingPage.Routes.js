const express = require("express");
const router = express.Router();
const homepageSectionController = require("../Controllers/LandingPage.controllers");

router.get("/homepage", homepageSectionController.getAllHomepageSections);
router.post("/homepage", homepageSectionController.createHomepageSection);
router.put("/homepage/:section_key/toggle-active", homepageSectionController.toggleActiveHomepageSection);
router.put("/homepage/:section_key/display-mode", homepageSectionController.updateDisplayModeHomepageSection);

module.exports = router;
