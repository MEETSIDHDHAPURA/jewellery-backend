const cron = require("node-cron");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../Models/Order.Model");
const Coupon = require("../Models/Coupon.Model");
const CouponUsage = require("../Models/CouponUsage.Model");
const DiamondPrice = require("../Models/DiamondPrice.Model");
const sendOrderConfirmationEmail = require("./sendOrderEmail");

const checkPendingPayments = async () => {
  try {
    console.log("[CRON] Checking pending Stripe checkout payments...");

    // Find orders still Pending, having a paymentId (Stripe session id), created in the last 24 hours
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingOrders = await Order.find({
      paymentStatus: "Pending",
      paymentId: { $ne: null, $exists: true },
      createdAt: { $gte: cutoffDate }
    });

    if (pendingOrders.length === 0) {
      console.log("[CRON] No pending orders found in the last 24 hours.");
      return;
    }

    console.log(`[CRON] Found ${pendingOrders.length} pending orders to verify.`);

    for (const order of pendingOrders) {
      try {
        // Skip check if paymentId is not a valid Stripe checkout session ID format
        if (!order.paymentId.startsWith("cs_")) {
          continue;
        }

        console.log(`[CRON] Retrieving Stripe Checkout Session for order #${order.orderId || order._id} (Session: ${order.paymentId})`);
        
        const session = await stripe.checkout.sessions.retrieve(order.paymentId);
        
        if (session && session.payment_status === "paid") {
          console.log(`[CRON] Order #${order.orderId || order._id} has been paid! Completing order...`);
          
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
            console.error("[CRON] Error clearing user cart:", cartError);
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

              // Create usage log
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

          // ─── Send Confirmation Email ───
          try {
            await sendOrderConfirmationEmail(order._id);
            console.log(`[CRON] Confirmation email sent for order #${order.orderId || order._id}`);
          } catch (emailError) {
            console.error(`[CRON] Error sending email for order #${order._id}:`, emailError);
          }
        } else {
          console.log(`[CRON] Order #${order.orderId || order._id} Stripe session status: ${session ? session.payment_status : "not found"}`);
        }
      } catch (orderError) {
        console.error(`[CRON] Failed to verify payment for order ${order._id}:`, orderError.message);
      }
    }
  } catch (error) {
    console.error("[CRON] Error in checkPendingPayments cron job:", error.message);
  }
};

const startPaymentCron = () => {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    checkPendingPayments();
  });
  console.log("[CRON] Stripe pending payment checker cron job registered.");
};

module.exports = {
  startPaymentCron
};
