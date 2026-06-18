const express = require("express");
const router = express.Router();
const { auth } = require("../Middlewares/auth.middleware");
const activityLogController = require("../Controllers/ActivityLog.controllers");

router.get("/all", auth, activityLogController.getActivityLogs);

module.exports = router;
