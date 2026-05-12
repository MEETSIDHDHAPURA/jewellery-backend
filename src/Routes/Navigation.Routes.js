const express = require("express");
const router = express.Router();
const navController = require("../Controllers/Navigation.controllers");

router.post("/update", navController.updateNavigation);
router.get("/header", navController.getHeaderNavigation);

module.exports = router;
