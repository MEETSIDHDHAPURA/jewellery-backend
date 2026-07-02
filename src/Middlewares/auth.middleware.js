const jwt = require("jsonwebtoken");
const ApiError = require("../Utils/ApiError");
const User = require("../Models/User.Model");

// Optional authentication - decodes token if present but doesn't block request if missing/invalid
const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "user_secret_key");
      req.user = { _id: decoded.id, email: decoded.email };
    }
    next();
  } catch (error) {
    // Fail silently or clear user to ensure non-blocking optional auth
    req.user = null;
    next();
  }
};

// Strict authentication - returns 401 if token is invalid or missing
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json(new ApiError(401, "Authorization token required"));
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "user_secret_key");
    
    // Find user in DB to verify role and status
    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json(new ApiError(401, "User account is invalid or suspended"));
    }

    req.user = { _id: user._id, email: user.email, role: user.role };
    next();
  } catch (error) {
    return res.status(401).json(new ApiError(401, "Invalid or expired authorization token"));
  }
};

// Admin authentication - requires strict auth, then checks user role in DB
const adminOnly = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json(new ApiError(401, "Authorization token required"));
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "user_secret_key");
    
    // Find user in DB to verify role
    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json(new ApiError(401, "User account is invalid or suspended"));
    }

    if (user.role !== "admin" && user.role !== "SuperAdmin") {
      return res.status(403).json(new ApiError(403, "Access denied. Admin role required."));
    }

    req.user = { _id: user._id, email: user.email, role: user.role };
    next();
  } catch (error) {
    return res.status(401).json(new ApiError(401, "Invalid or expired authorization token"));
  }
};

module.exports = {
  auth,
  requireAuth,
  adminOnly,
};
