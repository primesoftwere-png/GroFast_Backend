// router/Admin/adminManagement.router.js
const express = require('express');
const router = express.Router();
const managementController = require('../../controllers/Admin/adminManagement.controller');
const authMiddleware = require('../../middlewere/user.middlewere');
const roleMiddleware = require('../../middlewere/role.middleware');

// ==================== CATEGORY MANAGEMENT ====================
// GET /api/admin/categories - Get all categories with pagination
router.get('/categories', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getCategories
);

// GET /api/admin/categories/:id - Get category by ID
router.get('/categories/:id', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getCategoryById
);

// ==================== USER MANAGEMENT ====================
// GET /api/admin/users - Get all users with pagination
router.get('/users', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getUsers
);

// GET /api/admin/users/:id - Get user by ID
router.get('/users/:id', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getUserById
);

// PATCH /api/admin/users/:id/block - Block user
router.patch('/users/:id/block', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.blockUser
);

// PATCH /api/admin/users/:id/unblock - Unblock user
router.patch('/users/:id/unblock', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.unblockUser
);

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.deleteUser
);

// ==================== SHOPKEEPER MANAGEMENT ====================
// GET /api/admin/shopkeepers - Get all shopkeepers with pagination
router.get('/shopkeepers', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getShopkeepers
);

// GET /api/admin/shopkeepers/:id - Get shopkeeper by ID
router.get('/shopkeepers/:id', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getShopkeeperById
);

// PATCH /api/admin/shopkeepers/:id/approve - Approve shopkeeper
router.patch('/shopkeepers/:id/approve', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.approveShopkeeper
);

// PATCH /api/admin/shopkeepers/:id/reject - Reject shopkeeper
router.patch('/shopkeepers/:id/reject', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.rejectShopkeeper
);

// ==================== DELIVERY BOY MANAGEMENT ====================
// GET /api/admin/delivery-boys - Get all delivery boys with pagination
router.get('/delivery-boys', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getDeliveryBoys
);

// GET /api/admin/delivery-boys/:id - Get delivery boy by ID
router.get('/delivery-boys/:id', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.getDeliveryBoyById
);

// PATCH /api/admin/delivery-boys/:id/approve - Approve delivery boy
router.patch('/delivery-boys/:id/approve', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.approveDeliveryBoy
);

// PATCH /api/admin/delivery-boys/:id/reject - Reject delivery boy
router.patch('/delivery-boys/:id/reject', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isSuperAdmin,
  managementController.rejectDeliveryBoy
);

// ==================== KYC MANAGEMENT ====================
// GET /api/admin/kyc/shopkeepers - Get all shopkeeper KYC requests
router.get('/kyc/shopkeepers', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isAdmin,
  managementController.getShopkeeperKYC
);

// PATCH /api/admin/kyc/shopkeepers/:id/approve - Approve shopkeeper KYC
router.patch('/kyc/shopkeepers/:id/approve', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isAdmin,
  managementController.approveShopkeeperKYC
);

// PATCH /api/admin/kyc/shopkeepers/:id/reject - Reject shopkeeper KYC
router.patch('/kyc/shopkeepers/:id/reject', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isAdmin,
  managementController.rejectShopkeeperKYC
);

// GET /api/admin/kyc/delivery-boys - Get all delivery boy KYC requests
router.get('/kyc/delivery-boys', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isAdmin,
  managementController.getDeliveryBoyKYC
);

// PATCH /api/admin/kyc/delivery-boys/:id/approve - Approve delivery boy KYC
router.patch('/kyc/delivery-boys/:id/approve', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isAdmin,
  managementController.approveDeliveryBoyKYC
);

// PATCH /api/admin/kyc/delivery-boys/:id/reject - Reject delivery boy KYC
router.patch('/kyc/delivery-boys/:id/reject', 
  authMiddleware.userMiddlewere, 
  roleMiddleware.isAdmin,
  managementController.rejectDeliveryBoyKYC
);

console.log('✅ Admin Management routes loaded');

module.exports = router;
