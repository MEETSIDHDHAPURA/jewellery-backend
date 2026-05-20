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
const looseDiamondRoutes = require("./Routes/LooseDiamond.Routes");
const navigationRoutes = require("./Routes/Navigation.Routes");
const reviewRoutes = require("./Routes/Review.Routes");
const metalRateRoutes = require("./Routes/MetalRate.routes");
const taxRoutes = require("./Routes/Tax.Routes");
const makingChargeRoutes = require("./Routes/MakingCharge.routes");
const supportRoutes = require("./Routes/Support.Routes");
const pricingModifierRoutes = require("./Routes/PricingModifier.Routes");
const diamondPriceRoutes = require("./Routes/DiamondPrice.routes");

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
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
app.use("/api/v1/loose-diamond", looseDiamondRoutes);
app.use("/api/v1/navigation", navigationRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/metal-rate", metalRateRoutes);
app.use("/api/v1/tax", taxRoutes);
app.use("/api/v1/making-charge", makingChargeRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/pricing-modifier", pricingModifierRoutes);
app.use("/api/v1/diamond-price", diamondPriceRoutes);

module.exports = app;
