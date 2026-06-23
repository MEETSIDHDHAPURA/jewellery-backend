const express = require("express");
const router = express.Router();
const herotextControllers = require("../Controllers/Herotext.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.post("/create", adminOnly, herotextControllers.createHeroText);
router.get("/all", herotextControllers.getAllHeroTexts);
router.get("/get/:id", herotextControllers.getHeroTextById);
router.put("/update/:id", adminOnly, herotextControllers.updateHeroText);
router.delete("/delete/:id", adminOnly, herotextControllers.deleteHeroText);

module.exports = router;
