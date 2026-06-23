const express = require("express");
const { adminOnly } = require("../Middlewares/auth.middleware");
const { getMetalRates, updateMetalRates } = require("../Controllers/MetalRate.controller.js");

const router = express.Router();

router.get("/", getMetalRates);
router.put("/", adminOnly, updateMetalRates); 

module.exports = router;

