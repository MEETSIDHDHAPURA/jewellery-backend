const Blog = require("../Models/Blog.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Blog
const createBlog = async (req, res) => {
  try {
    const { title, content, author, tags } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : undefined;

    if (!title || !content) {
      throw new ApiError(400, "Title and Content are required");
    }

    const blog = await Blog.create({
      title,
      content,
      author,
      image,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
    });

    res.status(201).json(new ApiResponse(201, blog, "Blog created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Blogs
const getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, blogs, "Blogs fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get Blog By Id
const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) throw new ApiError(404, "Blog not found");
    res.status(200).json(new ApiResponse(200, blog, "Blog fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Blog
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) throw new ApiError(404, "Blog not found");
    res.status(200).json(new ApiResponse(200, {}, "Blog deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById,
  deleteBlog,
};
