const express = require("express");
const {
  createTaxProvince,
  getAllTaxProvinces,
  updateTaxProvince,
  deleteTaxProvince,
} = require("../Controllers/Tax.controllers.js");

const router = express.Router();

router.post("/", createTaxProvince);
router.get("/", getAllTaxProvinces);
router.put("/:id", updateTaxProvince);
router.delete("/:id", deleteTaxProvince);

module.exports = router;
