const mongoose = require('mongoose');
const productModel = require("../../models/Product.model");
const Category = require("../../models/ProductCategory.model");

module.exports.addProduct = async (req, res) => {
  try {
    const {
      productCode,
      productName,
      productDescription,
      productPrice,
      productCategory,
      productQuantity,
      productUnit,
      createdBy,
    } = req.body;

    console.log("req.body:", req.body);
    console.log("req.file:", req.file);

    const productImage = req.file ? "uploads/" + req.file.filename : null;
    console.log("productImage:", productImage);

    if (
      !productCode ||
      !productName ||
      !productDescription ||
      !productPrice ||
      !productCategory ||
      !productQuantity ||
      (!productUnit || productUnit.trim() === '') ||
      !productImage ||
      !createdBy
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Create product directly
    const product = new productModel({
      productCode,
      productName,
      productPrice: Number(productPrice),
      productDescription,
      productCategory,
      productImage,
      productQuantity,
      productUnit,
      createdBy,
    });
    await product.save();

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

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

    const categoryImage = req.file ? "uploads/" + req.file.filename : null;

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

module.exports.getProducts = async (req, res) => {
  try {
    const products = await productModel.find().populate('productCategory', 'categoryName').lean();
    res.status(200).json({ message: "Products retrieved successfully", products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;

    console.log("req.body:", req.body);
    if (req.file) {
      updateData.productImage = "uploads/" + req.file.filename;
    }

    if (updateData.productUnit && updateData.productUnit.trim() !== '') {
      updateData.productUnit = updateData.productUnit.trim();
    } else if ('productUnit' in updateData) {
      delete updateData.productUnit;
    }

    // Update product directly
    const updatedProduct = await productModel.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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

    const categoryImage = req.file ? "uploads/" + req.file.filename : null;

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

module.exports.getProductsByUserId = async (req, res) => {
  try {
    const { createdBy } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(createdBy)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const products = await productModel.find({ createdBy }).populate('productCategory', 'categoryName');
    res.status(200).json({ message: "Products retrieved successfully", products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ status: 'active' })
      .populate('parentCategoryId', 'categoryName')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ message: "Categories retrieved successfully", categories });
  } catch (error) {
    console.error(error);
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

module.exports.getProductByCategoryIdAndUserId = async (req, res) => {
  try {
    const { categoryId, userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(categoryId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid category or user ID" });
    }

    const products = await productModel.find({
      productCategory: categoryId,
      createdBy: userId,
    }).populate('productCategory', 'categoryName');

    res.status(200).json({ message: "Products retrieved successfully", products });
  } catch (error) {
    console.error(error);
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

    // Fetch all active categories
    const categories = await Category.find({ status: 'active' })
      .populate('parentCategoryId', 'categoryName')
      .select('_id categoryName description status')
      .lean();

    if (!categories || categories.length === 0) {
      return res.status(200).json({ 
        message: "Categories with products retrieved successfully",
        categories: [] 
      });
    }

    // For each category, fetch products for the specific user
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

module.exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const deletedProduct = await productModel.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      product: deletedProduct,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Check if category has children before delete
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

module.exports.getByProductId = async (req, res) => {
  try {
    const { productId } = req.params;
    console.log("Fetching product with ID:", productId);
    
    const product = await productModel
      .findById(productId)
      .populate("productCategory")
      .populate({
        path: "createdBy",
        select: "fullname email role",
      });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getDashboardOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    
    // Build query
    const query = {};
    if (status) {
      query.orderStatus = status.toUpperCase();
    }
    
    if (search) {
      // Add search by orderNumber or customer details if needed
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const Order = require('../../models/Customer/Order');

    // Get counts
    const total = await Order.countDocuments();
    const pending = await Order.countDocuments({ orderStatus: 'PENDING' });
    const confirmed = await Order.countDocuments({ orderStatus: 'CONFIRMED' });
    const preparing = await Order.countDocuments({ orderStatus: 'PREPARING' });
    const readyForPickup = await Order.countDocuments({ orderStatus: 'READY_FOR_PICKUP' });
    const assigned = await Order.countDocuments({ orderStatus: 'ASSIGNED' });
    const pickedUp = await Order.countDocuments({ orderStatus: 'PICKED_UP' });
    const onTheWay = await Order.countDocuments({ orderStatus: 'OUT_FOR_DELIVERY' });
    const delivered = await Order.countDocuments({ orderStatus: 'DELIVERED' });
    const cancelled = await Order.countDocuments({ orderStatus: 'CANCELLED' });
    const failed = await Order.countDocuments({ orderStatus: 'FAILED' });

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get orders
    const recentOrders = await Order.find(query)
      .populate('customerId', 'fullname phone email')
      .populate('shopId', 'fullname shopName phone')
      .populate('deliveryBoyId', 'fullname phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
      
    const filteredTotal = await Order.countDocuments(query);

    return res.status(200).json({
      success: true,
      summary: {
        total, pending, confirmed, preparing, 
        ready_for_pickup: readyForPickup, 
        assigned, picked_up: pickedUp, 
        on_the_way: onTheWay, delivered, cancelled, failed
      },
      recentOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTotal
      }
    });
  } catch (error) {
    console.error('Get dashboard orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};