const Order = require("../Models/Order.Model");
const Coupon = require("../Models/Coupon.Model");
const CouponUsage = require("../Models/CouponUsage.Model");
const DiamondPrice = require("../Models/DiamondPrice.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const logActivity = require("../Utils/logActivity");

// Create Order
const createOrder = async (req, res) => {
  try {
    const { items, subTotal, discountAmount, totalAmount, couponCode, shippingAddress } = req.body;

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
        const random = Math.floor(10000 + Math.random() * 90000);
        newOrderId = `Order-${DD}${MM}${YY}${random}`;
        const existingOrder = await Order.findOne({ orderId: newOrderId });
        if (!existingOrder) {
          isUnique = true;
        }
      }
      return newOrderId;
    };

    const orderId = await generateUniqueOrderId();

    const order = await Order.create({
      orderId,
      user: req.user ? req.user._id : req.body.userId, // Support both logged in and guest with ID
      items,
      subTotal,
      discountAmount,
      totalAmount,
      couponCode,
      shippingAddress,
    });

    // ─── Manage Diamond Stock ───
    for (const item of items) {
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
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon) {
        // Increment global used count
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save();

        // Create usage log for reporting & per-customer limit tracking
        const userId = req.user ? req.user._id : req.body.userId;
        if (userId) {
          await CouponUsage.create({
            coupon: coupon._id,
            user: userId,
            order: order._id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountAmount: discountAmount || 0,
            orderTotal: totalAmount || 0,
          });
        }
      }
    }

    res.status(201).json(new ApiResponse(201, order, "Order placed successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user")
      .populate("items.product")
      .populate("items.diamond")
      .sort({ createdAt: -1 });
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

    const orders = await Order.find({ user: userId })
      .populate("items.product")
      .populate("items.diamond")
      .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, orders, "User orders fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus, trackingId } = req.body;

    const order = await Order.findById(id);
    if (!order) throw new ApiError(404, "Order not found");

    const originalStatus = order.orderStatus;
    const originalPaymentStatus = order.paymentStatus;

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingId) order.trackingId = trackingId;

    await order.save();

    let changes = [];
    if (orderStatus && originalStatus !== orderStatus) {
      changes.push(`status to ${orderStatus}`);
    }
    if (paymentStatus && originalPaymentStatus !== paymentStatus) {
      changes.push(`payment status to ${paymentStatus}`);
    }
    if (trackingId) {
      changes.push(`tracking ID to ${trackingId}`);
    }

    const actionDesc = `Update order ${order.orderId || order._id}: changed ${changes.join(", ")}`;
    await logActivity(req, "Update", actionDesc);

    res.status(200).json(new ApiResponse(200, order, "Order status updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Order By ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
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

    res.status(200).json(new ApiResponse(200, order, "Order fetched successfully"));
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
};
