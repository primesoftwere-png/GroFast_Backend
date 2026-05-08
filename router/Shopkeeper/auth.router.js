// router/Shopkeeper/auth.router.js
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/shopkeeper/shopkeeperAuth.controller');
const kycController = require('../../controllers/shopkeeper/shopkeeperKYC.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// Public routes (no authentication required)
router.post('/register/basic', authController.registerBasic);
router.post('/login', authController.loginShopkeeper);

// Protected routes (authentication required)
router.post('/register/complete', authMiddleware.userMiddlewere, authController.completeProfile);
router.get('/profile', authMiddleware.userMiddlewere, authController.getProfile);
router.put('/shop/update', authMiddleware.userMiddlewere, authController.updateShopDetails);
router.post('/shop/toggle-status', authMiddleware.userMiddlewere, authController.toggleShopStatus);

// KYC Routes
router.post('/kyc/submit', authMiddleware.userMiddlewere, kycController.submitKYC);
router.get('/kyc/status', authMiddleware.userMiddlewere, kycController.getKYCStatus);
router.put('/kyc/update', authMiddleware.userMiddlewere, kycController.updateKYC);

module.exports = router;
