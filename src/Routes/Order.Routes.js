const express = require("express");
const router = express.Router();
const { auth } = require("../Middlewares/auth.middleware");
const orderController = require("../Controllers/Order.controllers");

router.post("/create", auth, orderController.createOrder);
router.get("/all", orderController.getAllOrders);
router.get("/user/:userId", orderController.getUserOrders);
router.put("/status/:id", auth, orderController.updateOrderStatus);
router.get("/:id", orderController.getOrderById);

module.exports = router;
