// router/Delivery/delivery.router.js
const express = require('express');
const router = express.Router();
const deliveryController = require('../../controllers/Delivery/delivery.controller');
const deliveryKYCController = require('../../controllers/Delivery/deliveryKYC.controller');
const deliveryOrderController = require('../../controllers/Delivery/deliveryOrderManagement.controller');
const authMiddleware = require('../../middlewere/user.middlewere');
const { authorizeRoles } = require('../../middlewere/role.middleware');

// Middleware to protect all delivery routes
const protectDeliveryRoutes = [
  authMiddleware.userMiddlewere,
  authorizeRoles('deliveryBoy')
];

// ==================== AUTHENTICATION ROUTES ====================
// Public routes (no authentication required)
router.post('/auth/register', deliveryController.registerDeliveryBoy);
router.post('/auth/login', deliveryController.loginDeliveryBoy);
router.post('/auth/verify-email', deliveryController.verifyEmail);

// Protected routes
router.post('/auth/logout', protectDeliveryRoutes, deliveryController.logoutDeliveryBoy);

// ==================== PROFILE & KYC ROUTES ====================
router.get('/profile', protectDeliveryRoutes, deliveryController.getProfile);
router.put('/profile', protectDeliveryRoutes, deliveryController.updateProfile);

// KYC Routes (New)
router.post('/kyc/submit', protectDeliveryRoutes, deliveryKYCController.submitKYC);
router.get('/kyc/status', protectDeliveryRoutes, deliveryKYCController.getKYCStatus);
router.put('/kyc/update', protectDeliveryRoutes, deliveryKYCController.updateKYC);

// Legacy KYC Routes (for backward compatibility)
router.post('/kyc/upload', protectDeliveryRoutes, deliveryController.uploadKYC);

// ==================== AVAILABILITY & STATUS ROUTES ====================
router.post('/availability/toggle', protectDeliveryRoutes, deliveryController.toggleOnlineStatus);
router.get('/availability/status', protectDeliveryRoutes, deliveryController.getCurrentStatus);

// ==================== ORDER MANAGEMENT ROUTES (NEW SOCKET.IO FLOW) ====================
// IMPORTANT: Specific routes MUST come before parameterized routes (:orderId)
router.get('/orders/available', protectDeliveryRoutes, deliveryController.getAvailableOrders);
router.get('/orders/assigned', protectDeliveryRoutes, deliveryOrderController.getAssignedOrders);
router.post('/orders/accept', protectDeliveryRoutes, deliveryOrderController.acceptDeliveryRequest);
router.post('/orders/pickup', protectDeliveryRoutes, deliveryOrderController.pickupOrder);
router.post('/orders/complete', protectDeliveryRoutes, deliveryOrderController.completeDelivery);
router.post('/orders/reject', protectDeliveryRoutes, deliveryController.rejectOrder);

// NEW REAL-TIME FLOW ROUTES
router.post('/orders/:orderId/verify-otp', protectDeliveryRoutes, require('../../controllers/Customer/order.controller').verifyOtp);
router.post('/orders/:orderId/in-transit', protectDeliveryRoutes, require('../../controllers/Customer/order.controller').markInTransit);
router.post('/orders/:orderId/delivered', protectDeliveryRoutes, require('../../controllers/Customer/order.controller').markDelivered);

router.get('/orders/:orderId', protectDeliveryRoutes, deliveryOrderController.getOrderDetails);

// ==================== ORDER STATUS FLOW ROUTES (LEGACY) ====================
router.post('/orders/start-delivery', protectDeliveryRoutes, deliveryController.startDelivery);

// OTP Generation (for testing/admin)
router.post('/orders/otp/pickup', protectDeliveryRoutes, deliveryController.generatePickupOTP);
router.post('/orders/otp/delivery', protectDeliveryRoutes, deliveryController.generateDeliveryOTP);

// ==================== LOCATION ROUTES ====================
router.post('/location/update', protectDeliveryRoutes, deliveryController.updateLocation);
router.get('/location/current', protectDeliveryRoutes, deliveryController.getCurrentLocation);

// ==================== WALLET ROUTES ====================
router.get('/wallet/balance', protectDeliveryRoutes, deliveryController.getWalletBalance);
router.get('/wallet/transactions', protectDeliveryRoutes, deliveryController.getWalletTransactions);
router.get('/wallet/cod-summary', protectDeliveryRoutes, deliveryController.getCODSummary);

// ==================== SETTLEMENT ROUTES ====================
router.post('/settlement/request', protectDeliveryRoutes, deliveryController.requestSettlement);
router.get('/settlement/history', protectDeliveryRoutes, deliveryController.getSettlementHistory);
router.get('/settlement/:settlementId', protectDeliveryRoutes, deliveryController.getSettlementDetails);

// ==================== NOTIFICATION ROUTES ====================
router.get('/notifications', protectDeliveryRoutes, deliveryController.getNotifications);
router.put('/notifications/:notificationId/read', protectDeliveryRoutes, deliveryController.markNotificationAsRead);
router.put('/notifications/read-all', protectDeliveryRoutes, deliveryController.markAllNotificationsAsRead);
router.delete('/notifications/:notificationId', protectDeliveryRoutes, deliveryController.deleteNotification);
router.get('/notifications/unread-count', protectDeliveryRoutes, deliveryController.getUnreadCount);

// ==================== ISSUE ROUTES ====================
router.post('/issues/report', protectDeliveryRoutes, deliveryController.reportIssue);
router.get('/issues', protectDeliveryRoutes, deliveryController.getIssues);
router.get('/issues/:issueId', protectDeliveryRoutes, deliveryController.getIssueDetails);
router.get('/block-status', protectDeliveryRoutes, deliveryController.getBlockStatus);

module.exports = router;