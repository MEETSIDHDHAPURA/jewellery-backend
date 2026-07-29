const express = require("express");
const router = express.Router();
const userController = require("../Controllers/User.controllers");
const upload = require("../Middlewares/multer.middleware");
const { requireAuth, adminOnly } = require("../Middlewares/auth.middleware");

router.post("/register", userController.registerUser);
router.post("/verify-otp", userController.verifyOTP);
router.post("/resend-otp", userController.resendOTP);
router.post("/login", userController.loginUser);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password/:token", userController.resetPassword);
router.get("/profile/:id", requireAuth, userController.getUserProfile);
router.patch("/update-profile/:id", requireAuth, upload.single("avatar"), userController.updateUserProfile);
router.patch("/update-password/:id", requireAuth, userController.updatePassword);
router.get("/all", adminOnly, userController.getAllUsers);
router.patch("/:id/permissions", adminOnly, userController.updateUserPermissions);
router.post("/create-admin", adminOnly, userController.createAdminUser);

module.exports = router;
