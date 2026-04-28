const Product = require("../../models/Product.model");
const Category = require("../../models/ProductCategory.model");
const User = require("../../models/user.model");

// Dashboard (basic info)
module.exports.dashboard = async (req, res) => {
  try {
    const productCount = await Product.countDocuments();
    const categoryCount = await Category.countDocuments();
    const deliveryBoyCount = await User.countDocuments({ role: "deliveryBoy" });
    const shopkeeperCount = await User.countDocuments({ role: "shopkeeper" });
    const customerCount = await User.countDocuments({ role: "customer" });

    res.json({
      message: "Welcome to the Super Admin Dashboard",
      stats: {
        products: productCount,
        categories: categoryCount,
        deliveryBoys: deliveryBoyCount,
        shopkeepers: shopkeeperCount,
        customers: customerCount,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to load dashboard", error: error.message });
  }
};

// Get all products
module.exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("createdBy", "name email");
    console.log(products);
    res.json({ success: true, products });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch products",
        error: error.message,
      });
  }
};

// Get all categories
module.exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json({ success: true, categories });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch categories",
        error: error.message,
      });
  }
};

// Get all delivery boys
module.exports.getDeliveryBoys = async (req, res) => {
  try {
    const deliveryBoys = await User.find({ role: "deliveryBoy" });
    res.json({ success: true, deliveryBoys });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch delivery boys",
        error: error.message,
      });
  }
};

// Get all shopkeepers
module.exports.getShopkeepers = async (req, res) => {
  try {
    const shopkeepers = await User.find({ role: "shopkeeper" });
    res.json({ success: true, shopkeepers });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch shopkeepers",
        error: error.message,
      });
  }
};

// Get all customers
module.exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" });
    res.json({ success: true, customers });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch customers",
        error: error.message,
      });
  }
};
