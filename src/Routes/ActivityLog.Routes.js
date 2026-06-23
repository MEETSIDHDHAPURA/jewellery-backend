const express = require("express");
const router = express.Router();
const { adminOnly } = require("../Middlewares/auth.middleware");
const activityLogController = require("../Controllers/ActivityLog.controllers");

router.get("/all", adminOnly, activityLogController.getActivityLogs);

module.exports = router;
