const mongoose = require('mongoose');
const productModel = require("../../models/Product.model");

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
      productImage: imageFromBody, // *** THE FIX: Destructure productImage from body as fallback ***
    } = req.body;

    console.log("req.body:", req.body);
    console.log("req.file:", req.file);

    // *** THE FIX: Prioritize uploaded file, fallback to body URL string ***
    let productImage = req.file ? req.file.filename : imageFromBody;

    console.log("productImage:", productImage);

    if (
      !productCode ||
      !productName ||
      !productDescription ||
      !productPrice ||
      !productCategory ||
      !productQuantity ||
      (!productUnit || productUnit.trim() === '') ||
      !productImage || // Now checks the resolved productImage (file or URL)
      !createdBy
    ) {
      return res.status(400).json({ 
        message: "All fields are required",
        missing: { // *** OPTIONAL: Enhanced error for debugging ***
          productCode: !!productCode,
          productName: !!productName,
          productDescription: !!productDescription,
          productPrice: !!productPrice,
          productCategory: !!productCategory,
          productQuantity: !!productQuantity,
          productUnit: !!productUnit && productUnit.trim() !== '',
          productImage: !!productImage,
          createdBy: !!createdBy,
        }
      });
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
      productUnit: productUnit.trim(),
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
      updateData.productImage = req.file.filename;
    } else if (updateData.productImage) { // *** THE FIX: Also handle URL update from body ***
      // Keep as-is if already provided
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