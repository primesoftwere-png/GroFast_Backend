const mongoose = require('mongoose');
const Category = require("../../models/ProductCategory.model");
const productModel = require("../../models/Product.model");

module.exports.addCategory = async (req, res) => {
  try {
    const { 
      categoryName, 
      description, 
      categoryType,
      parentCategoryId, 
      status = 'active', 
      createdBy 
    } = req.body;

    if (!categoryName || categoryName.trim() === '') {
      return res.status(400).json({ message: "Category name is required" });
    }

    const type = categoryType || (parentCategoryId ? 'child' : 'parent');

    if (type === 'child' && (!parentCategoryId || parentCategoryId === '')) {
      return res.status(400).json({ message: "Parent category is required when creating a child category" });
    }

    if (type === 'parent' && parentCategoryId) {
      return res.status(400).json({ message: "Parent category cannot have a parentCategoryId" });
    }

    let safeParentId = parentCategoryId;
    if (parentCategoryId === '' || parentCategoryId === undefined || parentCategoryId === null) {
      safeParentId = undefined;
    } else if (parentCategoryId && !mongoose.Types.ObjectId.isValid(parentCategoryId)) {
      return res.status(400).json({ message: "Invalid parent category ID" });
    }

    const validStatuses = ['active', 'inactive', 'pending'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be one of: " + validStatuses.join(', ') });
    }

    const categoryImage = req.file ? req.file.filename : null;

    // Create category directly
    const category = new Category({
      categoryName: categoryName.trim(),
      description: description ? description.trim() : '',
      categoryType: type,
      parentCategoryId: safeParentId,
      categoryImage: type === 'parent' && categoryImage ? categoryImage : undefined,
      status,
      createdBy,
    });
    await category.save();
    await category.populate('parentCategoryId', 'categoryName');

    res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.getCategories = async (req, res) => {
  try {
    const userId = req.user._id; // Get logged-in user's ID
    
    const { 
      search, 
      status, 
      parentOnly,
      page = 1,
      limit = 20,
      sortBy = 'categoryName',
      sortOrder = 'asc'
    } = req.query;
    
    // Build query - Fetch all categories so shopkeeper can use them
    let query = {};
    
    // Filter by status (default to active if not specified)
    if (status) {
      query.status = status;
    } else {
      query.status = 'active'; // Default to active categories
    }
    
    // Search by category name
    if (search) {
      query.categoryName = { $regex: search, $options: 'i' };
    }
    
    // Filter for parent categories only
    if (parentOnly === 'true') {
      query.parentCategoryId = null;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await Category.countDocuments(query);
    
    // Get categories with pagination
    const categories = await Category.find(query)
      .populate('parentCategoryId', 'categoryName')
      .populate('createdBy', 'fullname email')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get product count for each category (only products created by this shopkeeper)
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await productModel.countDocuments({ 
          productCategory: category._id,
          createdBy: userId // Only count products created by this shopkeeper
        });
        
        return {
          ...category,
          productCount: productCount
        };
      })
    );
      
    res.status(200).json({ 
      success: true,
      message: "Categories retrieved successfully", 
      data: {
        categories: categoriesWithCount,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};

module.exports.updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { 
      categoryName, 
      description,
      categoryType,
      parentCategoryId, 
      status 
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (categoryName && categoryName.trim() === '') {
      return res.status(400).json({ message: "Category name cannot be empty" });
    }

    let safeParentId = parentCategoryId !== undefined ? parentCategoryId : existingCategory.parentCategoryId;
    const newCategoryType = categoryType || (safeParentId ? 'child' : 'parent');

    if (newCategoryType === 'child' && (!safeParentId || safeParentId === '')) {
      return res.status(400).json({ message: "Parent category is required when updating to a child category" });
    }

    if (newCategoryType === 'parent') {
      safeParentId = null;
    }

    if (safeParentId && safeParentId !== '' && !mongoose.Types.ObjectId.isValid(safeParentId)) {
      return res.status(400).json({ message: "Invalid parent category ID" });
    }

    if (safeParentId === '') {
      safeParentId = null;
    }

    if (status && !['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const categoryImage = req.file ? req.file.filename : null;

    const updateData = {
      ...(categoryName && { categoryName: categoryName.trim() }),
      ...(description !== undefined && { description: description ? description.trim() : '' }),
      ...(categoryType && { categoryType }),
      parentCategoryId: safeParentId,
      ...(status !== undefined && { status }),
    };

    if (newCategoryType === 'parent' && categoryImage) {
      updateData.categoryImage = categoryImage;
    } else if (newCategoryType === 'child') {
      updateData.categoryImage = null; // Unset image if it changes to child
    }

    // Update category directly
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      updateData,
      { new: true, runValidators: true }
    ).populate('parentCategoryId', 'categoryName description');

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findById(categoryId)
      .populate('parentCategoryId', 'categoryName description')
      .select('-__v')
      .lean();

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      message: "Category retrieved successfully",
      category,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.getAllCategoriesWithProducts = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const categories = await Category.find({ status: 'active' })
      .populate('parentCategoryId', 'categoryName')
      .select('_id categoryName description status')
      .lean();

    if (!categories || categories.length === 0) {
      return res.status(200).json({
        message: "Categories with products retrieved successfully",
        categories: [],
      });
    }

    const categoriesWithProducts = await Promise.all(
      categories.map(async (category) => {
        const products = await productModel
          .find({
            productCategory: category._id,
            createdBy: userId,
          })
          .populate('productCategory', 'categoryName')
          .select('-__v')
          .lean();

        return {
          ...category,
          products: products || [],
        };
      })
    );

    res.status(200).json({
      message: "Categories with products retrieved successfully",
      categories: categoriesWithProducts,
    });
  } catch (error) {
    console.error("Error fetching categories with products:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const hasChildren = await Category.countDocuments({ parentCategoryId: categoryId });
    if (hasChildren > 0) {
      return res.status(400).json({ message: "Cannot delete category with child categories" });
    }

    const deletedCategory = await Category.findByIdAndDelete(categoryId);
    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      category: deletedCategory,
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};