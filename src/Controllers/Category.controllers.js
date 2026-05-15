const Category = require("../Models/Category.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Category
const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name) {
      throw new ApiError(400, "Category name is required");
    }

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      throw new ApiError(409, "Category already exists");
    }

    const category = await Category.create({
      name,
      description,
      image,
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
    const { name, description, image, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    if (name) {
      category.name = name;
    }
    if (description) category.description = description;
    if (image) category.image = image;
    if (typeof isActive !== "undefined") category.isActive = isActive;

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
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

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
