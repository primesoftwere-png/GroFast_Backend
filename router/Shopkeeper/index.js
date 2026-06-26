const express = require("express");
const router = express.Router();

// Import all shopkeeper routes
const authRoutes = require("./auth.router");
const productRoutes = require("./product.router");
const categoryRoutes = require("./category.router");
const orderRoutes = require("./order.router");
const inventoryRoutes = require("./inventory.router");
const settingsRoutes = require("./settings.router");
const incomeRoutes = require("./income.router");
const settlementRoutes = require("./settlement.router");
const advertisementRoutes = require("./advertisement.router");
const dashboardRoutes = require("./dashboard.router");


// Mount sub-routes
router.use("/auth", authRoutes); // Authentication & Registration
router.use("/product", productRoutes); // Product management
router.use("/category", categoryRoutes); // Category management
router.use("/", orderRoutes); // Order management
router.use("/", inventoryRoutes); // Inventory management
router.use("/", settingsRoutes); // Settings & Wallet
router.use("/", incomeRoutes); // Income management
router.use("/", settlementRoutes); // Settlement management
router.use("/advertisement", advertisementRoutes); // Advertisement management
router.use("/", dashboardRoutes); // Dashboard management


module.exports = router;