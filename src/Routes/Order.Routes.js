const express = require("express");
const router = express.Router();
const { auth, requireAuth, adminOnly } = require("../Middlewares/auth.middleware");
const orderController = require("../Controllers/Order.controllers");

router.post("/create", auth, orderController.createOrder); // support guest user creation with optional auth
router.get("/all", adminOnly, orderController.getAllOrders);
router.get("/user/:userId", requireAuth, orderController.getUserOrders);
router.put("/status/:id", adminOnly, orderController.updateOrderStatus);
router.get("/:id", auth, orderController.getOrderById); // support guest order fetching with optional auth

module.exports = router;
