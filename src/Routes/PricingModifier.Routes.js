const express = require("express");
const router = express.Router();
const controller = require("../Controllers/PricingModifier.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.get("/all", controller.getAllModifiers);
router.get("/all-flat", controller.getAllModifiersFlat);
router.post("/create", adminOnly, controller.createModifier);
router.put("/update/:id", adminOnly, controller.updateModifier);
router.delete("/delete/:id", adminOnly, controller.deleteModifier);
router.post("/seed", adminOnly, controller.seedDefaults);
router.post("/calculate-price", controller.calculatePrice);

module.exports = router;
