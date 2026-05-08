// router/Admin/kycRoutes.js
const express = require('express');
const router = express.Router();
const adminKYCController = require('../../controllers/Admin/adminKYC.controller');
const authMiddleware = require('../../middlewere/user.middlewere');
const { authorizeRoles } = require('../../middlewere/role.middleware');

// Middleware to protect all admin routes
const protectAdminRoutes = [
  authMiddleware.userMiddlewere,
  authorizeRoles('admin', 'superadmin')
];

// ==================== DELIVERY BOY KYC ROUTES ====================
// Get all pending delivery boy KYCs
router.get('/delivery-boy/pending', protectAdminRoutes, adminKYCController.getPendingDeliveryBoyKYCs);

// Get all delivery boy KYCs (with optional status filter)
router.get('/delivery-boy/all', protectAdminRoutes, adminKYCController.getAllDeliveryBoyKYCs);

// Get single delivery boy KYC details
router.get('/delivery-boy/:kycId', protectAdminRoutes, adminKYCController.getDeliveryBoyKYCDetails);

// Approve delivery boy KYC
router.post('/delivery-boy/:kycId/approve', protectAdminRoutes, adminKYCController.approveDeliveryBoyKYC);

// Reject delivery boy KYC
router.post('/delivery-boy/:kycId/reject', protectAdminRoutes, adminKYCController.rejectDeliveryBoyKYC);

// ==================== SHOPKEEPER KYC ROUTES ====================
// Get all pending shopkeeper KYCs
router.get('/shopkeeper/pending', protectAdminRoutes, adminKYCController.getPendingShopkeeperKYCs);

// Get all shopkeeper KYCs (with optional status filter)
router.get('/shopkeeper/all', protectAdminRoutes, adminKYCController.getAllShopkeeperKYCs);

// Get single shopkeeper KYC details
router.get('/shopkeeper/:kycId', protectAdminRoutes, adminKYCController.getShopkeeperKYCDetails);

// Approve shopkeeper KYC
router.post('/shopkeeper/:kycId/approve', protectAdminRoutes, adminKYCController.approveShopkeeperKYC);

// Reject shopkeeper KYC
router.post('/shopkeeper/:kycId/reject', protectAdminRoutes, adminKYCController.rejectShopkeeperKYC);

module.exports = router;
