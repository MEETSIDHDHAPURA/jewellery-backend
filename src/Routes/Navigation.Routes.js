const express = require("express");
const router = express.Router();
const navController = require("../Controllers/Navigation.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.post("/update", adminOnly, navController.updateNavigation);
router.get("/header", navController.getHeaderNavigation);

module.exports = router;
