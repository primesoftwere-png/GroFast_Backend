const express = require("express");
const router = express.Router();

const productRoutes = require("./product.router");
const categoryRoutes = require("./category.router");
// Add other shopkeeper-specific routes as needed

// Mount sub-routes
router.use("/product", productRoutes); // e.g., /api/shopkeeper/products/...
router.use("/category", categoryRoutes); // e.g., /api/shopkeeper/categories/...

module.exports = router;