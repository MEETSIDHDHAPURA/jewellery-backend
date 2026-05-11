const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const contactRoutes = require("./Routes/Contact.Routes");
const categoryRoutes = require("./Routes/Category.Routes");

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/category", categoryRoutes);



module.exports = app;
