const express = require("express");
const { auth } = require("../Middlewares/auth.middleware");
const {
  createTaxProvince,
  getAllTaxProvinces,
  updateTaxProvince,
  deleteTaxProvince,
} = require("../Controllers/Tax.controllers.js");

const router = express.Router();

router.post("/", auth, createTaxProvince);
router.get("/", getAllTaxProvinces);
router.put("/:id", auth, updateTaxProvince);
router.delete("/:id", auth, deleteTaxProvince);

module.exports = router;
