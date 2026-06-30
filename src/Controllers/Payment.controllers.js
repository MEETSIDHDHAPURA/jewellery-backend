const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const { orderId, currency = "usd" } = req.body;
    if (!orderId) {
      throw new ApiError(400, "OrderId is required");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    const targetCurrency = currency.toLowerCase();
    let convertedAmount = order.totalAmount;

    if (targetCurrency === "inr" || targetCurrency === "cad") {
      const config = await GlobalConfig.findOne({ key: "currency_rates" });
      const rates = config ? config.value : { INR: 83.5, CAD: 1.36 };

      console.log("Currency Rates:", rates);

      if (targetCurrency === "inr") {
        convertedAmount = order.totalAmount * (rates.INR || 83.5);
      } else if (targetCurrency === "cad") {
        convertedAmount = order.totalAmount * (rates.CAD || 1.36);
      }
      convertedAmount = Math.round(convertedAmount);
    }

    const amountInCents = Math.round(convertedAmount * 100);

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
      success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/cart?success=true&orderId=${order._id}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/cart?canceled=true&orderId=${order._id}`,
      metadata: {
        orderId: order._id.toString(),
      },
    });

    order.paymentId = session.id;
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
          if (order.paymentStatus !== "Completed") {
            order.paymentStatus = "Completed";
            order.paymentId = session.payment_intent || session.id;
            await order.save();

            // ─── Manage Diamond Stock ───
            for (const item of order.items) {
              if (item.diamond) {
                await DiamondPrice.findByIdAndUpdate(
                  item.diamond,
                  [
                    {
                      $set: {
                        stock: { $subtract: ["$stock", item.quantity || 1] }
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
              const userDoc = await User.findById(order.user);
              const customerEmail = userDoc ? userDoc.email : (order.shippingAddress?.email || order.email);
              const customerName = userDoc ? userDoc.name : (order.shippingAddress?.firstName ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName || ''}`.trim() : "Valued Customer");

              if (customerEmail) {
                const populatedOrder = await Order.findById(order._id)
                  .populate("items.product")
                  .populate("items.diamond");

                let itemsListHtml = "";
                for (const item of populatedOrder.items) {
                  let title = "Untitled Product";
                  let variant = "";
                  if (item.product) {
                    title = item.product.title || "Untitled Product";
                  } else if (item.diamond) {
                    title = `Loose Diamond - ${item.diamond.shape || ''} ${item.diamond.diamondType || ''}`;
                  }

                  const parts = [];
                  if (item.variantDetails) {
                    if (item.variantDetails.metal) parts.push(item.variantDetails.metal);
                    if (item.variantDetails.carat) parts.push(item.variantDetails.carat);
                    if (item.variantDetails.clarity) parts.push(item.variantDetails.clarity);
                    if (item.variantDetails.color) parts.push(item.variantDetails.color);
                    if (item.variantDetails.size) parts.push(`Size ${item.variantDetails.size}`);
                  }
                  variant = parts.join(" · ") || "Standard";

                  itemsListHtml += `
                    <tr>
                      <td style="padding: 15px 0; border-bottom: 1px solid #edf2f7; text-align: left;">
                        <span style="font-weight: 600; color: #2d3748;">${title}</span>
                        <div style="font-size: 12px; color: #718096; margin-top: 4px;">${variant}</div>
                      </td>
                      <td style="padding: 15px 0; border-bottom: 1px solid #edf2f7; text-align: center; color: #2d3748;">
                        ${item.quantity}
                      </td>
                      <td style="padding: 15px 0; border-bottom: 1px solid #edf2f7; text-align: right; font-weight: 600; color: #2d3748;">
                        $${(item.price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  `;
                }

                let discountRowHtml = "";
                if (order.discountAmount && order.discountAmount > 0) {
                  discountRowHtml = `
                    <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #e53e3e;">
                      <span>Discount (${order.couponCode || "Coupon"})</span>
                      <span>-$${order.discountAmount.toFixed(2)}</span>
                    </div>
                  `;
                }

                const currentYear = new Date().getFullYear();
                const orderDateFormatted = new Date(populatedOrder.createdAt).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                });

                const emailHtml = `<!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body {
                      margin: 0;
                      padding: 0;
                      background-color: #f4f6f8;
                      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                      color: #333333;
                    }
                    .email-container {
                      max-width: 600px;
                      margin: 0 auto;
                      background-color: #ffffff;
                      border-radius: 12px;
                      overflow: hidden;
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                      border: 1px solid #e1e8ed;
                    }
                    .header {
                      background-color: #1B386B;
                      color: #ffffff;
                      text-align: center;
                      padding: 40px 20px;
                    }
                    .header h1 {
                      margin: 0;
                      font-size: 28px;
                      font-family: Georgia, serif;
                      letter-spacing: 2px;
                      font-weight: 300;
                      text-transform: uppercase;
                    }
                    .header p {
                      margin: 10px 0 0 0;
                      font-size: 14px;
                      color: #b0c4de;
                      letter-spacing: 1px;
                      text-transform: uppercase;
                    }
                    .content {
                      padding: 30px;
                    }
                    .greeting {
                      font-size: 18px;
                      font-weight: 500;
                      margin-bottom: 20px;
                      color: #1B386B;
                    }
                    .message {
                      font-size: 15px;
                      line-height: 1.6;
                      color: #555555;
                      margin-bottom: 30px;
                    }
                    .order-info {
                      background-color: #f8fafc;
                      border: 1px solid #e2e8f0;
                      border-radius: 8px;
                      padding: 20px;
                      margin-bottom: 30px;
                    }
                    .order-info-title {
                      font-size: 14px;
                      font-weight: 700;
                      color: #1B386B;
                      text-transform: uppercase;
                      margin-bottom: 12px;
                      letter-spacing: 0.5px;
                    }
                    .order-info-row {
                      display: flex;
                      justify-content: space-between;
                      font-size: 14px;
                      margin-bottom: 8px;
                    }
                    .order-info-row:last-child {
                      margin-bottom: 0;
                    }
                    .order-info-label {
                      color: #718096;
                    }
                    .order-info-value {
                      color: #2d3748;
                      font-weight: 600;
                    }
                    .items-table {
                      width: 100%;
                      border-collapse: collapse;
                      margin-bottom: 30px;
                    }
                    .items-table th {
                      text-align: left;
                      font-size: 12px;
                      font-weight: 700;
                      text-transform: uppercase;
                      color: #718096;
                      border-bottom: 2px solid #edf2f7;
                      padding-bottom: 10px;
                      letter-spacing: 0.5px;
                    }
                    .summary-table {
                      width: 100%;
                      margin-top: 20px;
                      border-top: 2px solid #edf2f7;
                      padding-top: 15px;
                    }
                    .summary-row {
                      display: flex;
                      justify-content: space-between;
                      padding: 6px 0;
                      font-size: 14px;
                      color: #555555;
                    }
                    .summary-row.total {
                      font-size: 18px;
                      font-weight: 700;
                      color: #1B386B;
                      border-top: 1px solid #e2e8f0;
                      padding-top: 12px;
                      margin-top: 6px;
                    }
                    .address-box {
                      font-size: 14px;
                      color: #555555;
                      line-height: 1.5;
                    }
                    .footer {
                      background-color: #f8fafc;
                      border-top: 1px solid #edf2f7;
                      padding: 30px;
                      text-align: center;
                      font-size: 12px;
                      color: #a0aec0;
                    }
                    .footer a {
                      color: #1B386B;
                      text-decoration: none;
                      font-weight: 600;
                    }
                  </style>
                </head>
                <body>
                  <div class="email-container">
                    <div class="header">
                      <h1>${process.env.STORE_NAME || "PRAYA DIAMONDS"}</h1>
                      <p>Order Confirmed</p>
                    </div>
                    <div class="content">
                      <div class="greeting">Dear ${customerName},</div>
                      <div class="message">
                        Thank you for shopping with ${process.env.STORE_NAME || "Praya Diamonds"}. Your order has been successfully placed and is now being processed. Below are the details of your order.
                      </div>
                      
                      <div class="order-info">
                        <div class="order-info-title">Order Information</div>
                        <div class="order-info-row">
                          <span class="order-info-label">Order Number:</span>
                          <span class="order-info-value">${populatedOrder.orderId}</span>
                        </div>
                        <div class="order-info-row">
                          <span class="order-info-label">Order Date:</span>
                          <span class="order-info-value">${orderDateFormatted}</span>
                        </div>
                        <div class="order-info-row">
                          <span class="order-info-label">Payment Status:</span>
                          <span class="order-info-value" style="color: #319795;">${populatedOrder.paymentStatus}</span>
                        </div>
                      </div>
        
                      <table class="items-table">
                        <thead>
                          <tr>
                            <th style="width: 60%; text-align: left;">Product</th>
                            <th style="width: 15%; text-align: center;">Qty</th>
                            <th style="width: 25%; text-align: right;">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${itemsListHtml}
                        </tbody>
                      </table>
        
                      <div class="summary-table">
                        <div class="summary-row">
                          <span>Subtotal</span>
                          <span>$${order.subTotal.toFixed(2)}</span>
                        </div>
                        ${discountRowHtml}
                        <div class="summary-row">
                          <span>Shipping</span>
                          <span>Free</span>
                        </div>
                        <div class="summary-row total">
                          <span>Total</span>
                          <span>$${order.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
        
                      <div style="margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 30px;">
                        <div class="order-info-title">Shipping Address</div>
                        <div class="address-box">
                          <strong>${customerName}</strong><br>
                          ${order.shippingAddress.street || ""}<br>
                          ${order.shippingAddress.city || ""}, ${order.shippingAddress.state || ""} ${order.shippingAddress.zip || ""}<br>
                          ${order.shippingAddress.country || ""}
                        </div>
                      </div>
                    </div>
                    <div class="footer">
                      <p>If you have any questions, please contact our customer support team at <a href="mailto:${process.env.SMTP_USER}">${process.env.SMTP_USER}</a>.</p>
                      <p style="margin-top: 15px;">&copy; ${currentYear} ${process.env.STORE_NAME || "Praya Diamonds"}. All rights reserved.</p>
                    </div>
                  </div>
                </body>
                </html>`;

                await sendMail(customerEmail, `Order Confirmation - ${populatedOrder.orderId}`, emailHtml);
              }
            } catch (emailError) {
              console.error("Error sending order confirmation email:", emailError);
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
