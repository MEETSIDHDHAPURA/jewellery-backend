const express = require("express");
const router = express.Router();
const userController = require("../Controllers/User.controllers");
const upload = require("../middlewares/multer.middleware");

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password/:token", userController.resetPassword);
router.get("/profile/:id", userController.getUserProfile);
router.patch("/update-profile/:id", upload.single("avatar"), userController.updateUserProfile);
router.patch("/update-password/:id", userController.updatePassword);
router.get("/all", userController.getAllUsers);

module.exports = router;
