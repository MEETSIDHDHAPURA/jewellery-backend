const express = require("express");
const router = express.Router();
const policyController = require("../Controllers/Policy.controllers");

router.post("/update", policyController.updatePolicy);
router.get("/all", policyController.getAllPolicies);
router.get("/get/:type", policyController.getPolicyByType);

module.exports = router;
