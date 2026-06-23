const express = require("express");
const router = express.Router();
const policyController = require("../Controllers/Policy.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");

router.post("/update", adminOnly, policyController.updatePolicy);
router.get("/all", policyController.getAllPolicies);
router.get("/get/:type", policyController.getPolicyByType);

module.exports = router;
