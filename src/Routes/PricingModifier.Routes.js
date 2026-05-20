const express = require("express");
const router = express.Router();
const controller = require("../Controllers/PricingModifier.controllers");

router.get("/all", controller.getAllModifiers);
router.get("/all-flat", controller.getAllModifiersFlat);
router.post("/create", controller.createModifier);
router.put("/update/:id", controller.updateModifier);
router.delete("/delete/:id", controller.deleteModifier);
router.post("/seed", controller.seedDefaults);
router.post("/calculate-price", controller.calculatePrice);

module.exports = router;
