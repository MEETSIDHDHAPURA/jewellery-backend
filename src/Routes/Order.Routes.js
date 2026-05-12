const express = require("express");
const router = express.Router();
const orderController = require("../Controllers/Order.controllers");

router.post("/create", orderController.createOrder);
router.get("/all", orderController.getAllOrders);
router.get("/user/:userId", orderController.getUserOrders);
router.put("/status/:id", orderController.updateOrderStatus);

module.exports = router;
