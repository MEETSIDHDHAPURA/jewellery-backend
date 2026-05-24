const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../../public", "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|webp|pdf|mp4|webm|mov|avi|mkv/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype) || file.mimetype === "application/pdf" || file.mimetype.startsWith("video/");

    if (extname && (mimetype || file.mimetype === "application/pdf" || file.mimetype.startsWith("video/"))) {
      return cb(null, true);
    } else {
      cb(new Error("Only images (jpeg, jpg, png, webp), PDFs and videos (mp4, webm, mov, avi, mkv) are allowed"));
    }
  },
});

module.exports = upload;
