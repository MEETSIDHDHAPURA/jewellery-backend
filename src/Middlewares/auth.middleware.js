const jwt = require("jsonwebtoken");
const ApiError = require("../Utils/ApiError");

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { _id: decoded.id, email: decoded.email };
    }
    next();
  } catch (error) {
    return res.status(401).json(new ApiError(401, "Invalid or expired authorization token"));
  }
};

module.exports = {
  auth,
};
