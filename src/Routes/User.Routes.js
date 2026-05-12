const express = require("express");
const router = express.Router();
const userController = require("../Controllers/User.controllers");

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password/:token", userController.resetPassword);
router.get("/profile/:id?", userController.getUserProfile);
router.put("/update/:id", userController.updateUserProfile);
router.get("/all", userController.getAllUsers);

module.exports = router;
