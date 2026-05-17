const TaxProvince = require("../Models/TaxProvince.Model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

// Create Tax Province
const createTaxProvince = async (req, res) => {
  try {
    const { name, country, categories } = req.body;

    if (!name) {
      throw new ApiError(400, "Province name is required");
    }

    const targetCountry = country || "USA";
    const existingProvince = await TaxProvince.findOne({ 
      name: { $regex: new RegExp("^" + name + "$", "i") },
      country: { $regex: new RegExp("^" + targetCountry + "$", "i") }
    });
    if (existingProvince) {
      throw new ApiError(409, "Province under this country already exists");
    }

    const province = await TaxProvince.create({
      name,
      country: targetCountry,
      categories: categories || [],
    });

    res.status(201).json(new ApiResponse(201, province, "Province created successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Get All Tax Provinces
const getAllTaxProvinces = async (req, res) => {
  try {
    const provinces = await TaxProvince.find({}).sort({ country: 1, name: 1 });
    res.status(200).json(new ApiResponse(200, provinces, "Provinces fetched successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Update Tax Province
const updateTaxProvince = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, country, categories } = req.body;

    const province = await TaxProvince.findById(id);
    if (!province) {
      throw new ApiError(404, "Province not found");
    }

    const targetName = name || province.name;
    const targetCountry = country || province.country;

    if (name || country) {
      // Check if duplicate exists
      const existingProvince = await TaxProvince.findOne({ 
        name: { $regex: new RegExp("^" + targetName + "$", "i") },
        country: { $regex: new RegExp("^" + targetCountry + "$", "i") },
        _id: { $ne: id }
      });
      if (existingProvince) {
        throw new ApiError(409, "Another province under this country already exists");
      }
      province.name = targetName;
      province.country = targetCountry;
    }
    if (categories) {
      province.categories = categories;
    }

    await province.save();

    res.status(200).json(new ApiResponse(200, province, "Province updated successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

// Delete Tax Province
const deleteTaxProvince = async (req, res) => {
  try {
    const { id } = req.params;
    const province = await TaxProvince.findByIdAndDelete(id);

    if (!province) {
      throw new ApiError(404, "Province not found");
    }

    res.status(200).json(new ApiResponse(200, {}, "Province deleted successfully"));
  } catch (error) {
    res.status(error.statusCode || 500).json(new ApiError(error.statusCode || 500, error.message));
  }
};

module.exports = {
  createTaxProvince,
  getAllTaxProvinces,
  updateTaxProvince,
  deleteTaxProvince,
};
