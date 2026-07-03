const Order = require("../Models/Order.Model");
const Coupon = require("../Models/Coupon.Model");
const CouponUsage = require("../Models/CouponUsage.Model");
const DiamondPrice = require("../Models/DiamondPrice.Model");
const User = require("../Models/User.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const logActivity = require("../Utils/logActivity");
const sendMail = require("../Utils/Nodemailer");
const GlobalConfig = require("../Models/GlobalConfig.Model");

// Create Order
const createOrder = async (req, res) => {
  try {
    const { items, subTotal, discountAmount, totalAmount, couponCode, shippingAddress, currency = "USD" } = req.body;

    if (!items || items.length === 0) {
      throw new ApiError(400, "Order items are required");
    }

    // Generate unique orderId
    const generateUniqueOrderId = async () => {
      const date = new Date();
      const DD = String(date.getDate()).padStart(2, "0");
      const MM = String(date.getMonth() + 1).padStart(2, "0");
      const YY = String(date.getFullYear()).slice(-2);

      let isUnique = false;
      let newOrderId = "";
      while (!isUnique) {
        const random = Math.floor(1000000 + Math.random() * 9000000);
        newOrderId = `${DD}${MM}${YY}${random}`;
        const existingOrder = await Order.findOne({ orderId: newOrderId });
        if (!existingOrder) {
          isUnique = true;
        }
      }
      return newOrderId;
    };

    const orderId = await generateUniqueOrderId();

    let rate = 1;
    const targetCurrency = currency.toUpperCase();
    if (targetCurrency !== "USD") {
      const config = await GlobalConfig.findOne({ key: "currency_rates" });
      const rates = config ? config.value : { INR: 83.5, CAD: 1.36 };
      if (targetCurrency === "INR") {
        rate = rates.INR || 83.5;
      } else if (targetCurrency === "CAD") {
        rate = rates.CAD || 1.36;
      }
    }

    const order = await Order.create({
      orderId,
      user: req.user ? req.user._id : req.body.userId, // Support both logged in and guest with ID
      items,
      subTotal,
      discountAmount,
      totalAmount,
      couponCode,
      shippingAddress,
      currency: targetCurrency,
      exchangeRate: rate,
    });

    res.status(201).json(new ApiResponse(201, order, "Order placed successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({ paymentStatus: { $ne: "Pending" } })
      .populate("user")
      .populate("items.product")
      .populate("items.diamond")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(new ApiResponse(200, orders, "Orders fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get User Orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Ensure user is fetching their own orders, or is an admin
    if (req.user?._id?.toString() !== userId?.toString() && req.user?.role !== "admin" && req.user?.role !== "SuperAdmin") {
      throw new ApiError(403, "Access denied. You can only view your own orders.");
    }

    const orders = await Order.find({ user: userId, paymentStatus: { $ne: "Pending" } })
      .populate("items.product")
      .populate("items.diamond")
      .populate("user")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json(new ApiResponse(200, orders, "User orders fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus, trackingId, trackingLink } = req.body;

    const order = await Order.findById(id);
    if (!order) throw new ApiError(404, "Order not found");

    const originalStatus = order.orderStatus;
    const originalPaymentStatus = order.paymentStatus;

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingId !== undefined) order.trackingId = trackingId;
    if (trackingLink !== undefined) order.trackingLink = trackingLink;

    await order.save();

    let changes = [];
    if (orderStatus && originalStatus !== orderStatus) {
      changes.push(`status to ${orderStatus}`);
    }
    if (paymentStatus && originalPaymentStatus !== paymentStatus) {
      changes.push(`payment status to ${paymentStatus}`);
    }
    if (trackingId !== undefined && trackingId !== originalStatus) {
      changes.push(`tracking ID to ${trackingId}`);
    }
    if (trackingLink !== undefined) {
      changes.push(`tracking Link to ${trackingLink}`);
    }

    const actionDesc = `Update order ${order.orderId || order._id}: changed ${changes.join(", ")}`;
    await logActivity(req, "Update", actionDesc);

    res.status(200).json(new ApiResponse(200, order, "Order status updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { $or: [{ _id: id }, { orderId: id }] } : { orderId: id };

    let order = await Order.findOne(query)
      .populate("items.product")
      .populate("items.diamond")
      .populate("user");
    if (!order) throw new ApiError(404, "Order not found");

    // Guest users can fetch guest orders if no user is linked to the order and no token is present,
    // but if the order is linked to a user, check ownership.
    if (order.user) {
      const orderUserId = order.user._id ? order.user._id.toString() : order.user.toString();
      if (!req.user || (req.user._id.toString() !== orderUserId && req.user.role !== "admin" && req.user.role !== "SuperAdmin")) {
        throw new ApiError(403, "Access denied. You do not have permission to view this order.");
      }
    }

    // Sync payment status from Stripe if order is still Pending but payment has been completed
    if (order.paymentStatus === "Pending" && order.paymentId) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(order.paymentId);
        if (session && session.payment_status === "paid") {
          order.paymentStatus = "Completed";
          order.paymentId = session.payment_intent || session.id;
          await order.save();

          // Send Confirmation Email
          try {
            const sendOrderConfirmationEmail = require("../Utils/sendOrderEmail");
            sendOrderConfirmationEmail(order._id);
          } catch (emailError) {
            console.error("Error sending order confirmation email:", emailError);
          }

          // Re-populate and query to return updated order details
          order = await Order.findById(order._id)
            .populate("items.product")
            .populate("items.diamond")
            .populate("user");

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
                });
              }
            }
          }
        }
      } catch (stripeErr) {
        console.error("Failed to check Stripe session status in getOrderById:", stripeErr.message);
      }
    }

    res.status(200).json(new ApiResponse(200, order, "Order fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Cancel/Delete Pending Order
const deletePendingOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // Only allow deleting if it's a Pending order (unpaid)
    if (order.paymentStatus !== "Pending") {
      throw new ApiError(400, "Cannot delete a completed or failed order");
    }

    await Order.findByIdAndDelete(id);
    res.status(200).json(new ApiResponse(200, null, "Pending order cancelled and deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Verify Payment Token (single-use route protection)
const verifyPaymentToken = async (req, res) => {
  try {
    const { orderId, token } = req.query;

    if (!orderId || !token) {
      return res.status(200).json(new ApiResponse(200, { valid: false }, "Missing orderId or token"));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(200).json(new ApiResponse(200, { valid: false }, "Order not found"));
    }

    if (!order.paymentToken || order.paymentToken !== token) {
      return res.status(200).json(new ApiResponse(200, { valid: false }, "Invalid or expired token"));
    }

    // Sync payment status from Stripe if order is still Pending but payment has been completed
    if (order.paymentStatus === "Pending" && order.paymentId) {
      try {
        const stripeObj = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripeObj.checkout.sessions.retrieve(order.paymentId);
        if (session && session.payment_status === "paid") {
          order.paymentStatus = "Completed";
          order.paymentId = session.payment_intent || session.id;
          await order.save();

          // Send Confirmation Email
          try {
            const sendOrderConfirmationEmail = require("../Utils/sendOrderEmail");
            sendOrderConfirmationEmail(order._id);
          } catch (emailError) {
            console.error("Error sending order confirmation email:", emailError);
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
              coupon.usedCount = (coupon.usedCount || 0) + 1;
              await coupon.save();

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
        }
      } catch (stripeErr) {
        console.error("Failed to check Stripe session status in verifyPaymentToken:", stripeErr.message);
      }
    }

    // Consume the token (single-use)
    order.paymentToken = null;
    await order.save();

    return res.status(200).json(new ApiResponse(200, { valid: true, paymentStatus: order.paymentStatus, orderId: order.orderId }, "Token verified"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getUserOrders,
  updateOrderStatus,
  getOrderById,
  deletePendingOrder,
  verifyPaymentToken,
};
