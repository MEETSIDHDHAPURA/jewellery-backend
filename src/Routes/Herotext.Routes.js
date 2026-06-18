const express = require("express");
const router = express.Router();
const herotextControllers = require("../Controllers/Herotext.controllers");
const { auth } = require("../Middlewares/auth.middleware");

router.post("/create", auth, herotextControllers.createHeroText);
router.get("/all", herotextControllers.getAllHeroTexts);
router.get("/get/:id", herotextControllers.getHeroTextById);
router.put("/update/:id", auth, herotextControllers.updateHeroText);
router.delete("/delete/:id", auth, herotextControllers.deleteHeroText);

module.exports = router;
