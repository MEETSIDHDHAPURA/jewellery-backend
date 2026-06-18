const express = require("express");
const { auth } = require("../Middlewares/auth.middleware");
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

router.post("/", auth, createMakingCharge);
router.get("/", getMakingCharges);
router.get("/config/margin", getMargin);
router.post("/config/margin", auth, setMargin);
router.get("/:id", getMakingChargeById);
router.put("/:id", auth, updateMakingCharge);
router.delete("/:id", auth, deleteMakingCharge);

module.exports = router;
