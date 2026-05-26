const cloudinary = require("cloudinary").v2;
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const isBase64 = typeof localFilePath === "string" && localFilePath.startsWith("data:");
    // upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfully
    if (!isBase64 && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return response;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    // remove the locally saved temporary file as the upload operation failed
    const isBase64 = typeof localFilePath === "string" && localFilePath.startsWith("data:");
    if (!isBase64 && localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};

/**
 * Helper to extract Cloudinary public_id from URL
 */
const getPublicIdFromUrl = (url) => {
  try {
    if (!url) return null;
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    const fileSegment = parts[1].replace(/^v\d+\//, "");
    const lastDotIndex = fileSegment.lastIndexOf(".");
    return lastDotIndex !== -1 ? fileSegment.substring(0, lastDotIndex) : fileSegment;
  } catch (err) {
    return null;
  }
};

/**
 * Delete file from Cloudinary using URL or public_id
 */
const deleteFromCloudinary = async (cloudinaryUrlOrPublicId, resourceType = null) => {
  try {
    if (!cloudinaryUrlOrPublicId) return null;

    let publicId = cloudinaryUrlOrPublicId;
    let detectedType = resourceType || "image";

    if (cloudinaryUrlOrPublicId.startsWith("http")) {
      publicId = getPublicIdFromUrl(cloudinaryUrlOrPublicId);
      if (cloudinaryUrlOrPublicId.includes("/video/")) {
        detectedType = "video";
      } else if (cloudinaryUrlOrPublicId.includes("/raw/")) {
        detectedType = "raw";
      }
    }

    if (!publicId) return null;

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: detectedType,
    });
    return result;
  } catch (error) {
    console.error("Cloudinary delete failed:", error);
    return null;
  }
};

/**
 * Update file on Cloudinary (Deletes old and uploads new)
 */
const updateOnCloudinary = async (oldUrlOrPublicId, newLocalFilePath) => {
  try {
    if (oldUrlOrPublicId) {
      await deleteFromCloudinary(oldUrlOrPublicId);
    }
    return await uploadOnCloudinary(newLocalFilePath);
  } catch (error) {
    console.error("Cloudinary update failed:", error);
    return null;
  }
};

module.exports = {
  uploadOnCloudinary,
  deleteFromCloudinary,
  updateOnCloudinary,
  getPublicIdFromUrl,
};
