// router/Admin/index.js (Perfected Admin Router Index)
const express = require('express');
const router = express.Router();

const adminRoutes = require('./admin.router'); // Assuming admin.router.js exists for other admin routes
const shopkeeperRoutes = require('./shopkeeperRoutes'); // Shopkeeper-specific routes
const kycRoutes = require('./kycRoutes'); // KYC management routes
const testDataController = require('../../controllers/Admin/testData.controller'); // Test data helper

// Mount sub-routes
router.use('/', adminRoutes); // e.g., /api/admin/login, /api/admin/dashboard
router.use('/shopkeeper', shopkeeperRoutes); // e.g., /api/admin/shopkeeper/register
router.use('/kyc', kycRoutes); // e.g., /api/admin/kyc/delivery-boy/pending, /api/admin/kyc/shopkeeper/pending

// Test data helper endpoint (for development/testing)
router.post('/test/create-orders', testDataController.createTestOrders); // e.g., /api/admin/test/create-orders

module.exports = router;