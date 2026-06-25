const express = require("express");
const router = express.Router();
const couponController = require("../Controllers/Coupon.controllers");
const { adminOnly } = require("../Middlewares/auth.middleware");
const upload = require("../Middlewares/multer.middleware");

// ─── CRUD ───
router.post("/create", adminOnly, upload.single("image"), couponController.createCoupon);
router.put("/update/:id", adminOnly, upload.single("image"), couponController.updateCoupon);
router.delete("/delete/:id", adminOnly, couponController.deleteCoupon);

// ─── Actions ───
router.get("/popup", couponController.getPopupCoupon);
router.post("/send-email", couponController.sendCouponEmail);
router.post("/validate", couponController.validateCoupon);
router.patch("/toggle-status/:id", adminOnly, couponController.toggleCouponStatus);

// ─── Read ───
router.get("/all", adminOnly, couponController.getAllCoupons);
router.get("/report/:id", adminOnly, couponController.getCouponReport);
router.get("/:id", adminOnly, couponController.getCouponById);

module.exports = router;
