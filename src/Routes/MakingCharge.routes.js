const express = require("express");
const { adminOnly } = require("../Middlewares/auth.middleware");
const {
  createMakingCharge,
  getMakingCharges,
  getMakingChargeById,
  updateMakingCharge,
  deleteMakingCharge,
  getMargin,
  setMargin,
  getCurrencyRates,
  setCurrencyRates,
} = require("../Controllers/MakingCharge.controller.js");

const router = express.Router();

router.post("/", adminOnly, createMakingCharge);
router.get("/", getMakingCharges);
router.get("/config/margin", getMargin);
router.post("/config/margin", adminOnly, setMargin);
router.get("/config/currency-rates", getCurrencyRates);
router.post("/config/currency-rates", adminOnly, setCurrencyRates);
router.get("/:id", getMakingChargeById);
router.put("/:id", adminOnly, updateMakingCharge);
router.delete("/:id", adminOnly, deleteMakingCharge);

module.exports = router;
