const express = require("express");
const router = express.Router();
const couponController = require("../Controllers/Coupon.controllers");

router.post("/create", couponController.createCoupon);
router.post("/validate", couponController.validateCoupon);
router.get("/all", couponController.getAllCoupons);

module.exports = router;
