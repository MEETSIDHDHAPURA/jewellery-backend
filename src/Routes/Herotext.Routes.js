const express = require("express");
const router = express.Router();
const herotextControllers = require("../Controllers/Herotext.controllers");

router.post("/create", herotextControllers.createHeroText);
router.get("/all", herotextControllers.getAllHeroTexts);
router.get("/get/:id", herotextControllers.getHeroTextById);
router.put("/update/:id", herotextControllers.updateHeroText);
router.delete("/delete/:id", herotextControllers.deleteHeroText);

module.exports = router;
