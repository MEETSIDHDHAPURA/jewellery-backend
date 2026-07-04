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

const multerInstance = multer({
  storage: storage,
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

const checkFileSizes = (req, res, next) => {
  const filesToCheck = [];
  if (req.file) {
    filesToCheck.push(req.file);
  }
  if (req.files) {
    if (Array.isArray(req.files)) {
      filesToCheck.push(...req.files);
    } else if (typeof req.files === "object") {
      Object.values(req.files).forEach((fileArr) => {
        if (Array.isArray(fileArr)) {
          filesToCheck.push(...fileArr);
        }
      });
    }
  }

  for (const file of filesToCheck) {
    const isVideo = file.mimetype.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.originalname);
    const limit = isVideo ? 10 * 1024 * 1024 : 5 * 1024 * 1024;

    if (file.size > limit) {
      // Clean up all uploaded files from disk
      for (const f of filesToCheck) {
        if (fs.existsSync(f.path)) {
          try {
            fs.unlinkSync(f.path);
          } catch (e) {
            console.error("Cleanup error:", e);
          }
        }
      }
      return res.status(400).json({
        message: `${isVideo ? 'Video' : 'Image/File'} size exceeds the limit of ${isVideo ? '10MB' : '5MB'}`,
        statusCode: 400
      });
    }
  }
  next();
};

const wrapMiddleware = (multerMiddleware) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        return next(err);
      }
      checkFileSizes(req, res, next);
    });
  };
};

const upload = {
  single: (fieldName) => wrapMiddleware(multerInstance.single(fieldName)),
  array: (fieldName, maxCount) => wrapMiddleware(multerInstance.array(fieldName, maxCount)),
  fields: (fields) => wrapMiddleware(multerInstance.fields(fields)),
  any: () => wrapMiddleware(multerInstance.any()),
  none: () => multerInstance.none(),
};

module.exports = upload;
