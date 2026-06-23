const express = require("express");
const router = express.Router();
const { adminOnly } = require("../Middlewares/auth.middleware");
const dashboardController = require("../Controllers/Dashboard.controllers");

router.get("/stats", adminOnly, dashboardController.getDashboardData);

module.exports = router;
