const express = require("express");
const { auth } = require("../Middlewares/auth.middleware");
const { getMetalRates, updateMetalRates } = require("../Controllers/MetalRate.controller.js");

const router = express.Router();

router.get("/", getMetalRates);
router.put("/", auth, updateMetalRates); 

module.exports = router;

