const express = require("express");
const {
  createMakingCharge,
  getMakingCharges,
  getMakingChargeById,
  updateMakingCharge,
  deleteMakingCharge,
} = require("../Controllers/MakingCharge.controller.js");

const router = express.Router();

router.post("/", createMakingCharge);
router.get("/", getMakingCharges);
router.get("/:id", getMakingChargeById);
router.put("/:id", updateMakingCharge);
router.delete("/:id", deleteMakingCharge);

module.exports = router;
