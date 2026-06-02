const Category = require("../Models/Category.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const { uploadOnCloudinary, updateOnCloudinary, deleteFromCloudinary } = require("../Utils/Cloudinary");

// Create Category
const createCategory = async (req, res) => {
  try {
    const { name, description, image, subcategories } = req.body;

    if (!name || !name.trim()) {
      throw new ApiError(400, "Category name is required");
    }

    const trimmedName = name.trim();

    const existingCategory = await Category.findOne({
      name: { $regex: `^${trimmedName}$`, $options: "i" }
    });
    if (existingCategory) {
      throw new ApiError(409, "Category already exists");
    }

    let imageUrl = "";
    if (image) {
      const uploadRes = await uploadOnCloudinary(image);
      if (uploadRes) {
        imageUrl = uploadRes.secure_url;
      }
    }

    let subcategoriesArr = [];
    if (subcategories) {
      if (Array.isArray(subcategories)) {
        subcategoriesArr = subcategories.map(s => s.trim()).filter(Boolean);
      } else if (typeof subcategories === "string") {
        try {
          const parsed = JSON.parse(subcategories);
          if (Array.isArray(parsed)) {
            subcategoriesArr = parsed.map(s => s.trim()).filter(Boolean);
          } else {
            subcategoriesArr = subcategories.split(",").map(s => s.trim()).filter(Boolean);
          }
        } catch (e) {
          subcategoriesArr = subcategories.split(",").map(s => s.trim()).filter(Boolean);
        }
      }
    }

    const category = await Category.create({
      name: trimmedName,
      description,
      image: imageUrl,
      subcategories: subcategoriesArr,
    });

    res.status(201).json(new ApiResponse(201, category, "Category created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Categories
const getAllCategories = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { isActive: true };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(query).sort({ name: 1 });
    res.status(200).json(new ApiResponse(200, categories, "Categories fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, isActive, subcategories } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    if (name) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new ApiError(400, "Category name cannot be empty");
      }

      const existingCategory = await Category.findOne({
        name: { $regex: `^${trimmedName}$`, $options: "i" },
        _id: { $ne: id }
      });
      if (existingCategory) {
        throw new ApiError(409, "Category name already exists");
      }
      category.name = trimmedName;
    }
    if (description) category.description = description;
    
    if (image) {
      if (image.startsWith("data:")) {
        const uploadRes = await updateOnCloudinary(category.image, image);
        if (uploadRes) {
          category.image = uploadRes.secure_url;
        }
      } else {
        category.image = image;
      }
    }
    
    if (typeof isActive !== "undefined") category.isActive = isActive;

    if (typeof subcategories !== "undefined") {
      let subcategoriesArr = [];
      if (Array.isArray(subcategories)) {
        subcategoriesArr = subcategories.map(s => s.trim()).filter(Boolean);
      } else if (typeof subcategories === "string") {
        try {
          const parsed = JSON.parse(subcategories);
          if (Array.isArray(parsed)) {
            subcategoriesArr = parsed.map(s => s.trim()).filter(Boolean);
          } else {
            subcategoriesArr = subcategories.split(",").map(s => s.trim()).filter(Boolean);
          }
        } catch (e) {
          subcategoriesArr = subcategories.split(",").map(s => s.trim()).filter(Boolean);
        }
      }
      category.subcategories = subcategoriesArr;
    }

    await category.save();

    res.status(200).json(new ApiResponse(200, category, "Category updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    if (category.image) {
      await deleteFromCloudinary(category.image);
    }

    await category.deleteOne();

    res.status(200).json(new ApiResponse(200, {}, "Category deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
