const express = require("express");
const router = express.Router();

// Import all shopkeeper routes
const authRoutes = require("./auth.router");
const productRoutes = require("./product.router");
const categoryRoutes = require("./category.router");
const orderRoutes = require("./order.router");
const inventoryRoutes = require("./inventory.router");
const settingsRoutes = require("./settings.router");

// Mount sub-routes
router.use("/auth", authRoutes); // Authentication & Registration
router.use("/product", productRoutes); // Product management
router.use("/category", categoryRoutes); // Category management
router.use("/", orderRoutes); // Order management
router.use("/", inventoryRoutes); // Inventory management
router.use("/", settingsRoutes); // Settings & Wallet

module.exports = router;