const express = require("express");
const router = express.Router();
const couponController = require("../Controllers/Coupon.controllers");
const { auth } = require("../Middlewares/auth.middleware");

// ─── CRUD ───
router.post("/create", auth, couponController.createCoupon);
router.put("/update/:id", auth, couponController.updateCoupon);
router.delete("/delete/:id", auth, couponController.deleteCoupon);

// ─── Read ───
router.get("/all", couponController.getAllCoupons);
router.get("/report/:id", couponController.getCouponReport);
router.get("/:id", couponController.getCouponById);

// ─── Actions ───
router.post("/validate", couponController.validateCoupon);
router.patch("/toggle-status/:id", auth, couponController.toggleCouponStatus);

module.exports = router;
