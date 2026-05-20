const express = require("express");
const {
  createMakingCharge,
  getMakingCharges,
  getMakingChargeById,
  updateMakingCharge,
  deleteMakingCharge,
  getMargin,
  setMargin,
} = require("../Controllers/MakingCharge.controller.js");

const router = express.Router();

router.post("/", createMakingCharge);
router.get("/", getMakingCharges);
router.get("/config/margin", getMargin);
router.post("/config/margin", setMargin);
router.get("/:id", getMakingChargeById);
router.put("/:id", updateMakingCharge);
router.delete("/:id", deleteMakingCharge);

module.exports = router;
