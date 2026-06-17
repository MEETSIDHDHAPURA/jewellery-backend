const Order = require("../Models/Order.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

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

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingId) order.trackingId = trackingId;

    await order.save();

    res.status(200).json(new ApiResponse(200, order, "Order status updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getUserOrders,
  updateOrderStatus,
};
