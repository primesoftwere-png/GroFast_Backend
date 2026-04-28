// router/Admin/index.js (Perfected Admin Router Index)
const express = require('express');
const router = express.Router();

const adminRoutes = require('./admin.router'); // Assuming admin.router.js exists for other admin routes
const shopkeeperRoutes = require('./shopkeeperRoutes'); // Shopkeeper-specific routes

// Mount sub-routes
router.use('/', adminRoutes); // e.g., /api/admin/login, /api/admin/dashboard
router.use('/shopkeeper', shopkeeperRoutes); // e.g., /api/admin/shopkeeper/register

module.exports = router;