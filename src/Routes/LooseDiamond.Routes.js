const express = require("express");
const router = express.Router();
const ldController = require("../Controllers/LooseDiamond.controllers");

router.post("/create", ldController.createLooseDiamond);
router.get("/all", ldController.getAllLooseDiamonds);

module.exports = router;
