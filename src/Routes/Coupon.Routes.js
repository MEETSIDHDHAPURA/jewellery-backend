const express = require("express");
const router = express.Router();
const couponController = require("../Controllers/Coupon.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");

// ─── CRUD ───
router.post("/create", adminOnly, couponController.createCoupon);
router.put("/update/:id", adminOnly, couponController.updateCoupon);
router.delete("/delete/:id", adminOnly, couponController.deleteCoupon);

// ─── Read ───
router.get("/all", adminOnly, couponController.getAllCoupons);
router.get("/report/:id", adminOnly, couponController.getCouponReport);
router.get("/:id", adminOnly, couponController.getCouponById);

// ─── Actions ───
router.post("/validate", couponController.validateCoupon);
router.get("/public/exit-intent", couponController.getPublicExitIntentCoupon);
router.patch("/toggle-status/:id", adminOnly, couponController.toggleCouponStatus);

module.exports = router;
