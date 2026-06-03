// router/Admin/index.js (Perfected Admin Router Index)
const express = require('express');
const router = express.Router();

const adminRoutes = require('./admin.router');
const adminDashboardRoutes = require('./adminDashboard.router');
const adminManagementRoutes = require('./adminManagement.router');
const adminExtendedRoutes = require('./adminExtended.router'); // Orders, Products, Coupons, Payments, Wallets, Withdraw, Reports, Settings, Support
const shopkeeperRoutes = require('./shopkeeperRoutes');
const kycRoutes = require('./kycRoutes');
const testDataController = require('../../controllers/Admin/testData.controller');

// Mount sub-routes
router.use('/', adminRoutes);
router.use('/', adminDashboardRoutes);
router.use('/', adminManagementRoutes);
router.use('/', adminExtendedRoutes); // All new extended APIs
router.use('/shopkeeper', shopkeeperRoutes);
router.use('/kyc', kycRoutes);

// Test data helper endpoint
router.post('/test/create-orders', testDataController.createTestOrders);

module.exports = router;