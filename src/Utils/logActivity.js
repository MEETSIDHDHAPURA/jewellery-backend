const ActivityLog = require("../Models/ActivityLog.Model");
const User = require("../Models/User.Model");

const logActivity = async (req, method, action) => {
  try {
    if (!req.user || !req.user._id) return;
    
    const adminUser = await User.findById(req.user._id);
    const adminName = adminUser ? adminUser.name : "Unknown Admin";

    await ActivityLog.create({
      admin: req.user._id,
      adminName,
      action,
      method,
    });
  } catch (error) {
    console.error("Error logging admin activity:", error);
  }
};

module.exports = logActivity;
