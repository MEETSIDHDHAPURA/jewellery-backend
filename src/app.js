const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const categoryRoutes = require("./Routes/Category.Routes");
const productRoutes = require("./Routes/Product.Routes");
const userRoutes = require("./Routes/User.Routes");
const orderRoutes = require("./Routes/Order.Routes");
const blogRoutes = require("./Routes/Blog.Routes");
const couponRoutes = require("./Routes/Coupon.Routes");
const policyRoutes = require("./Routes/Policy.Routes");
const navigationRoutes = require("./Routes/Navigation.Routes");
const reviewRoutes = require("./Routes/Review.Routes");
const metalRateRoutes = require("./Routes/MetalRate.routes");
const taxRoutes = require("./Routes/Tax.Routes");
const makingChargeRoutes = require("./Routes/MakingCharge.routes");
const supportRoutes = require("./Routes/Support.Routes");
const pricingModifierRoutes = require("./Routes/PricingModifier.Routes");
const diamondPriceRoutes = require("./Routes/DiamondPrice.routes");
const bannerRoutes = require("./Routes/Banner.Routes");
const homepageSectionRoutes = require("./Routes/LandingPage.Routes");
const customDesignRoutes = require("./Routes/CustomDesign.Routes");
const cartRoutes = require("./Routes/Cart.Routes");
const wishlistRoutes = require("./Routes/Wishlist.Routes");
const quotationRoutes = require("./Routes/Quotation.Routes");
const herotextRoutes = require("./Routes/Herotext.Routes");
const activityLogRoutes = require("./Routes/ActivityLog.Routes");
const dashboardRoutes = require("./Routes/Dashboard.Routes");
const paymentRoutes = require("./Routes/Payment.Routes");
const selfDestructRoutes = require("./Routes/SelfDestruct.Routes");


app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

// Mount Stripe payment & webhook routes (webhook needs raw body parsing)
app.use("/api/v1/payment", paymentRoutes);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "public", "uploads")));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/v1/category", categoryRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/order", orderRoutes);
app.use("/api/v1/blog", blogRoutes);
app.use("/api/v1/coupon", couponRoutes);
app.use("/api/v1/policy", policyRoutes);
app.use("/api/v1/navigation", navigationRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/metal-rate", metalRateRoutes);
app.use("/api/v1/tax", taxRoutes);
app.use("/api/v1/making-charge", makingChargeRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/pricing-modifier", pricingModifierRoutes);
app.use("/api/v1/diamond-price", diamondPriceRoutes);
app.use("/api/v1/banner", bannerRoutes);
app.use("/admin", homepageSectionRoutes);
app.use("/api/v1/admin", homepageSectionRoutes);
app.use("/api/v1/custom-design", customDesignRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/quotation", quotationRoutes);
app.use("/api/v1/herotext", herotextRoutes);
app.use("/api/v1/activity-log", activityLogRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/self-destruct", selfDestructRoutes);


module.exports = app;
