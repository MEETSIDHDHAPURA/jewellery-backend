const Order = require("../Models/Order.Model");
const Product = require("../Models/Product.Model");
const User = require("../Models/User.Model");
const Review = require("../Models/Review.Model");
const Quotation = require("../Models/Quotation.Model");
const CustomDesign = require("../Models/CustomDesign.Model");
const Support = require("../Models/Support.Model");
const Category = require("../Models/Category.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

const calculateGrowth = (current, previous) => {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
};

const getDashboardData = async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;
    const now = new Date();
    let startDate = new Date();
    let prevStartDate = new Date();

    const match = timeRange.match(/^(\d+)d$/);
    if (match) {
      const days = parseInt(match[1]);
      startDate.setDate(now.getDate() - days);
      prevStartDate.setDate(now.getDate() - (days * 2));
    } else if (timeRange === "all") {
      startDate = new Date(0); // Epoch start
      prevStartDate = new Date(0);
    } else {
      // Default to 30d
      startDate.setDate(now.getDate() - 30);
      prevStartDate.setDate(now.getDate() - 60);
    }

    // 1. KPI Stats calculations in parallel
    const [
      // Revenue
      currRevenueRes,
      prevRevenueRes,
      lifetimeRevenueRes,
      // Orders
      currOrdersCount,
      prevOrdersCount,
      totalOrdersCount,
      // Customers
      currCustomersCount,
      prevCustomersCount,
      totalCustomersCount,
      // Products
      activeProductsCount,
      // Quick Pending Counts
      pendingOrdersCount,
      totalQuotationsCount,
      pendingCustomCount,
      pendingSupportCount,
      // Distributions
      orderStatusDistribution,
      categoryDistribution,
      topProducts,
      // Recent Lists
      recentOrders,
      recentReviews,
      // Chart aggregates
      revenueOverTime
    ] = await Promise.all([
      // Current Revenue
      Order.aggregate([
        { $match: { paymentStatus: "Completed", createdAt: { $gte: startDate, $lte: now } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      // Previous Revenue
      Order.aggregate([
        { $match: { paymentStatus: "Completed", createdAt: { $gte: prevStartDate, $lt: startDate } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      // Lifetime Revenue
      Order.aggregate([
        { $match: { paymentStatus: "Completed" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),

      // Current Orders
      Order.countDocuments({ createdAt: { $gte: startDate, $lte: now } }),
      // Previous Orders
      Order.countDocuments({ createdAt: { $gte: prevStartDate, $lt: startDate } }),
      // Lifetime Orders
      Order.countDocuments(),

      // Current Customers
      User.countDocuments({ role: "user", isDeleted: false, createdAt: { $gte: startDate, $lte: now } }),
      // Previous Customers
      User.countDocuments({ role: "user", isDeleted: false, createdAt: { $gte: prevStartDate, $lt: startDate } }),
      // Lifetime Customers
      User.countDocuments({ role: "user", isDeleted: false }),

      // Active Products
      Product.countDocuments({ isActive: true, isDeleted: false }),

      // Pending Orders
      Order.countDocuments({ orderStatus: "Processing" }),
      // Total Quotations
      Quotation.countDocuments(),
      // Pending Custom Designs
      CustomDesign.countDocuments({ status: "Pending" }),
      // Pending Support Tickets
      Support.countDocuments({ status: "Pending" }),

      // Order status count distribution
      Order.aggregate([
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
      ]),

      // Products by category distribution
      Product.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$category", count: { $sum: 1 } } }
      ]),

      // Top Selling Products (aggregated from completed orders)
      Order.aggregate([
        { $match: { paymentStatus: "Completed" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            totalQuantity: { $sum: "$items.quantity" },
            totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            totalQuantity: 1,
            totalRevenue: 1,
            title: "$productInfo.title",
            sku: "$productInfo.sku",
            images: "$productInfo.metalImages"
          }
        }
      ]),

      // Recent Orders
      Order.find()
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Recent Reviews
      Review.find()
        .populate("user", "name email avatar")
        .populate("product", "title")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Chart: Revenue & Orders Over Time
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: now }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "Completed"] }, "$totalAmount", 0]
              }
            },
            ordersCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const currRevenue = currRevenueRes[0]?.total || 0;
    const prevRevenue = prevRevenueRes[0]?.total || 0;
    const lifetimeRevenue = lifetimeRevenueRes[0]?.total || 0;

    // Resolve Category names for Category distribution
    const resolvedCategoryDistribution = [];
    if (categoryDistribution.length > 0) {
      const categoryIds = categoryDistribution.map((c) => c._id).filter(Boolean);
      const categories = await Category.find({ _id: { $in: categoryIds } }).select("name").lean();
      const catMap = new Map(categories.map((c) => [c._id.toString(), c.name]));

      categoryDistribution.forEach((item) => {
        if (item._id) {
          resolvedCategoryDistribution.push({
            category: catMap.get(item._id.toString()) || "Unknown",
            count: item.count
          });
        }
      });
    }

    res.status(200).json(
      new ApiResponse(
        200,
        {
          kpis: {
            revenue: {
              value: lifetimeRevenue,
              currentPeriod: currRevenue,
              growth: calculateGrowth(currRevenue, prevRevenue)
            },
            orders: {
              value: totalOrdersCount,
              currentPeriod: currOrdersCount,
              growth: calculateGrowth(currOrdersCount, prevOrdersCount)
            },
            customers: {
              value: totalCustomersCount,
              currentPeriod: currCustomersCount,
              growth: calculateGrowth(currCustomersCount, prevCustomersCount)
            },
            products: {
              value: activeProductsCount,
              growth: 0 // Just total count
            }
          },
          quickStats: {
            pendingOrders: pendingOrdersCount,
            pendingQuotations: totalQuotationsCount,
            pendingCustomDesigns: pendingCustomCount,
            pendingSupportTickets: pendingSupportCount
          },
          charts: {
            revenueAndOrdersTrend: revenueOverTime.map(item => ({
              date: item._id,
              revenue: item.revenue,
              orders: item.ordersCount
            })),
            orderStatusDistribution: orderStatusDistribution.map(item => ({
              status: item._id,
              count: item.count
            })),
            categoryDistribution: resolvedCategoryDistribution,
            topProducts: topProducts.map(p => ({
              id: p._id,
              title: p.title || "Unnamed Product",
              sku: p.sku || "N/A",
              quantity: p.totalQuantity,
              revenue: p.totalRevenue,
              image: p.images ? (p.images.yellowGold?.[0] || p.images.whiteGold?.[0] || p.images.roseGold?.[0] || p.images.silver?.[0] || p.images.platinum?.[0] || "") : ""
            }))
          },
          recentOrders: recentOrders.map(o => ({
            id: o._id,
            orderId: o.orderId || o._id.toString().substring(0, 8).toUpperCase(),
            customer: o.user?.name || "Guest Customer",
            email: o.user?.email || "N/A",
            total: o.totalAmount,
            status: o.orderStatus,
            paymentStatus: o.paymentStatus,
            date: o.createdAt
          })),
          recentReviews: recentReviews.map(r => ({
            id: r._id,
            customer: r.user?.name || "Anonymous",
            avatar: r.user?.avatar || "",
            product: r.product?.title || "Deleted Product",
            rating: r.rating,
            comment: r.comment,
            date: r.createdAt
          }))
        },
        "Dashboard data aggregated successfully"
      )
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  getDashboardData
};
