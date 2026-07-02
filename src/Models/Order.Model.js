const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      sparse: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        diamond: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DiamondPrice",
        },
        variantDetails: Object,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    subTotal: {
      type: Number,
      required: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    couponCode: {
      type: String,
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Refunded"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Processing",
    },
    paymentId: String,
    trackingId: String,
    trackingLink: String,
    currency: {
      type: String,
      default: "USD",
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    paymentToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ "items.product": 1, paymentStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
