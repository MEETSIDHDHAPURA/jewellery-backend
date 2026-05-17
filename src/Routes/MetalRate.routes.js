const express = require("express");
const { getMetalRates, updateMetalRates } = require("../Controllers/MetalRate.controller.js");

const router = express.Router();

router.get("/", getMetalRates);
router.put("/", updateMetalRates); 

module.exports = router;

