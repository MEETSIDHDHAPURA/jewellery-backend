const ActivityLog = require("../Models/ActivityLog.Model");
const User = require("../Models/User.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", method = "" } = req.query;

    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.max(1, parseInt(limit) || 10);
    const skip = (safePage - 1) * safeLimit;

    const query = {};

    if (method && method !== "all") {
      query.method = method;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      }).select("_id");
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { adminName: searchRegex },
        { action: searchRegex },
        { method: searchRegex },
        { admin: { $in: userIds } }
      ];
    }

    const totalItems = await ActivityLog.countDocuments(query);
    const totalPages = Math.ceil(totalItems / safeLimit);

    const logs = await ActivityLog.find(query)
      .populate("admin", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          logs,
          totalItems,
          totalPages,
          currentPage: safePage,
          limit: safeLimit
        },
        "Activity logs fetched successfully"
      )
    );
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  getActivityLogs,
};
