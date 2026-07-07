const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");
const Order = require("../Models/Order.Model");
const User = require("../Models/User.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const sendMail = require("../Utils/Nodemailer");
const GlobalConfig = require("../Models/GlobalConfig.Model");
const DiamondPrice = require("../Models/DiamondPrice.Model");
const Coupon = require("../Models/Coupon.Model");
const CouponUsage = require("../Models/CouponUsage.Model");

// Create Stripe Checkout Session
const createCheckoutSession = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      throw new ApiError(400, "OrderId is required");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    const targetCurrency = (order.currency || "USD").toLowerCase();
    const rate = order.exchangeRate || 1;
    const convertedAmount = Math.round(order.totalAmount * rate);

    const amountInCents = Math.round(convertedAmount * 100);

    // Generate single-use payment token for route protection
    const paymentToken = crypto.randomUUID();

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: targetCurrency,
            product_data: {
              name: `Order #${order.orderId || order._id}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clientUrl}/order/success?orderId=${order.orderId}&token=${paymentToken}`,
      cancel_url: `${clientUrl}/order/failed?orderId=${order.orderId}&token=${paymentToken}`,
      metadata: {
        orderId: order._id.toString(),
      },
    });

    order.paymentId = session.id;
    order.paymentToken = paymentToken;
    await order.save();

    res.status(200).json(
      new ApiResponse(
        200,
        {
          url: session.url,
          sessionId: session.id,
        },
        "Checkout session created successfully"
      )
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Stripe Webhook Endpoint (requires raw body parser)
const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata.orderId;

      if (orderId) {
        const order = await Order.findById(orderId);
        if (order) {
          console.log(order.paymentStatus)
          if (order.paymentStatus !== "Completed") {
            order.paymentStatus = "Completed";
            order.paymentId = session.payment_intent || session.id;
            await order.save();

            // ─── Clear User's Cart ───
            try {
              const Cart = require("../Models/Cart.Model");
              const cart = await Cart.findOne({ user: order.user });
              if (cart) {
                cart.items = [];
                cart.couponCode = null;
                cart.discountAmount = 0;
                cart.discountType = null;
                cart.discountValue = 0;
                cart.freeShipping = false;
                await cart.save();
              }
            } catch (cartError) {
              console.error("Error clearing user cart:", cartError);
            }

            // ─── Manage Diamond Stock ───
            for (const item of order.items) {
              if (item.diamond) {
                await DiamondPrice.findByIdAndUpdate(
                  item.diamond,
                  [
                    {
                      $set: {
                        stock: {
                          $max: [0, { $subtract: ["$stock", item.quantity || 1] }]
                        }
                      }
                    },
                    {
                      $set: {
                        isSoldOut: {
                          $cond: {
                            if: { $lte: ["$stock", 0] },
                            then: true,
                            else: false
                          }
                        }
                      }
                    }
                  ],
                  { returnDocument: "after", updatePipeline: true }
                );
              }
            }

            // ─── Coupon Usage Logging ───
            if (order.couponCode) {
              const coupon = await Coupon.findOne({ code: order.couponCode.toUpperCase() });
              if (coupon) {
                // Increment global used count
                coupon.usedCount = (coupon.usedCount || 0) + 1;
                await coupon.save();

                // Create usage log for reporting & per-customer limit tracking
                const userId = order.user;
                if (userId) {
                  await CouponUsage.create({
                    coupon: coupon._id,
                    user: userId,
                    order: order._id,
                    code: coupon.code,
                    discountType: coupon.discountType,
                    discountAmount: order.discountAmount || 0,
                    orderTotal: order.totalAmount || 0,
                  });
                }
              }
            }

            // Send Confirmation Email
            try {
              const sendOrderConfirmationEmail = require("../Utils/sendOrderEmail");
              sendOrderConfirmationEmail(order._id);
            } catch (emailError) {
              console.error("Error invoking order confirmation email helper:", emailError);
            }
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (webhookError) {
    console.error("Error processing webhook event:", webhookError);
    res.status(500).json(new ApiError(500, webhookError.message));
  }
};

module.exports = {
  createCheckoutSession,
  stripeWebhook,
};
