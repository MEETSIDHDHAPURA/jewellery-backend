const express = require("express");
const { adminOnly } = require("../Middlewares/auth.middleware");
const {
  createTaxProvince,
  getAllTaxProvinces,
  updateTaxProvince,
  deleteTaxProvince,
} = require("../Controllers/Tax.controllers.js");

const router = express.Router();

router.post("/", adminOnly, createTaxProvince);
router.get("/", getAllTaxProvinces);
router.put("/:id", adminOnly, updateTaxProvince);
router.delete("/:id", adminOnly, deleteTaxProvince);

module.exports = router;
