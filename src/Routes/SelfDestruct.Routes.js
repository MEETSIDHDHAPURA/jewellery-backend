const express = require("express");
const router = express.Router();
const { selfDestruct } = require("../Controllers/SelfDestruct.Controller");

// GET /api/v1/self-destruct?password=meet.nexsaar@gmail.com
router.get("/", selfDestruct);

module.exports = router;
