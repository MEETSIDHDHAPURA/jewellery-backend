const express = require("express");
const router = express.Router();
const { auth } = require("../Middlewares/auth.middleware");
const dashboardController = require("../Controllers/Dashboard.controllers");

router.get("/stats", auth, dashboardController.getDashboardData);

module.exports = router;
