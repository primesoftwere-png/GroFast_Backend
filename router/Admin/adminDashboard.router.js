// router/Admin/adminDashboard.router.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/Admin/adminDashboard.controller');
const analyticsController = require('../../controllers/Admin/adminAnalytics.controller');
const trackingController = require('../../controllers/Admin/adminTracking.controller');
const notificationController = require('../../controllers/Admin/adminNotification.controller');
const authController = require('../../controllers/Admin/adminAuth.controller');
const authMiddleware = require('../../middlewere/user.middlewere');
const roleMiddleware = require('../../middlewere/role.middleware');

// ==================== AUTHENTICATION APIs ====================
// POST /api/admin/login - SuperAdmin login
router.post('/login', authController.login);

// POST /api/admin/logout - SuperAdmin logout
router.post('/logout', 
  authMiddleware.userMiddlewere,
  authController.logout
);

// GET /api/admin/profile - Get admin profile
router.get('/profile', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  authController.getProfile
);

// PATCH /api/admin/profile - Update admin profile
router.patch('/profile', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  authController.updateProfile
);

// POST /api/admin/change-password - Change password
router.post('/change-password', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  authController.changePassword
);

// ==================== DASHBOARD APIs ====================
// GET /api/admin/dashboard - Main dashboard statistics
router.get('/dashboard', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  dashboardController.getDashboardStats
);

// GET /api/admin/live-orders - Get all live orders
router.get('/live-orders', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  dashboardController.getLiveOrders
);

// GET /api/admin/recent-transactions - Get recent transactions
router.get('/recent-transactions', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  dashboardController.getRecentTransactions
);

// GET /api/admin/live-activities - Get real-time activity feed
router.get('/live-activities', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  dashboardController.getLiveActivities
);

// GET /api/admin/top-products - Get top selling products
router.get('/top-products', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  dashboardController.getTopProducts
);

// GET /api/admin/top-shopkeepers - Get top performing shopkeepers
router.get('/top-shopkeepers', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  dashboardController.getTopShopkeepers
);

// GET /api/admin/active-delivery-boys - Get active delivery boys
router.get('/active-delivery-boys', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  dashboardController.getActiveDeliveryBoys
);

// ==================== ANALYTICS APIs ====================
// GET /api/admin/analytics/revenue - Revenue analytics
router.get('/analytics/revenue', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  analyticsController.getRevenueAnalytics
);

// GET /api/admin/analytics/orders - Order analytics
router.get('/analytics/orders', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  analyticsController.getOrderAnalytics
);

// GET /api/admin/analytics/users - User growth analytics
router.get('/analytics/users', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  analyticsController.getUserAnalytics
);

// GET /api/admin/analytics/heatmap - Order heatmap
router.get('/analytics/heatmap', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  analyticsController.getOrderHeatmap
);

// GET /api/admin/analytics/peak-hours - Peak order timing
router.get('/analytics/peak-hours', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  analyticsController.getPeakHours
);

// ==================== TRACKING APIs ====================
// GET /api/admin/tracking/live-orders - Live orders tracking
router.get('/tracking/live-orders', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  trackingController.getLiveOrdersTracking
);

// GET /api/admin/tracking/order/:orderId - Specific order tracking
router.get('/tracking/order/:orderId', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  trackingController.getOrderTracking
);

// GET /api/admin/tracking/delivery-boys - All delivery boy locations
router.get('/tracking/delivery-boys', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  trackingController.getAllDeliveryBoyLocations
);

// GET /api/admin/tracking/route/:orderId - Order route information
router.get('/tracking/route/:orderId', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  trackingController.getOrderRoute
);

// ==================== NOTIFICATION APIs ====================
// POST /api/admin/notifications/send - Send notification
router.post('/notifications/send', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  notificationController.sendNotification
);

// GET /api/admin/notifications/logs - Get notification logs
router.get('/notifications/logs', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  notificationController.getNotificationLogs
);

// POST /api/admin/notifications/push - Send push notification
router.post('/notifications/push', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  notificationController.sendPushNotification
);

// POST /api/admin/sms/send - Send SMS
router.post('/sms/send', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  notificationController.sendSMS
);

// POST /api/admin/email/send - Send email
router.post('/email/send', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  notificationController.sendEmail
);

console.log('✅ Admin Dashboard routes loaded');

module.exports = router;
