const express = require("express");
const router = express.Router();
const paymentController = require("../Controllers/Payment.controllers");
const { auth } = require("../Middlewares/auth.middleware");

// Webhook endpoint needs raw request parser instead of global express.json()
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook
);

router.post(
  "/create-checkout-session",
  express.json(),
  auth,
  paymentController.createCheckoutSession
);

module.exports = router;
