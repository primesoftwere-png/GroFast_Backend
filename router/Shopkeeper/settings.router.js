// router/Shopkeeper/settings.router.js
const express = require('express');
const router = express.Router();
const settingsController = require('../../controllers/shopkeeper/settings.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// All routes require authentication
router.use(authMiddleware.userMiddlewere);

// Settings
router.get('/settings', settingsController.getSettings);
router.put('/settings/business-hours', settingsController.updateBusinessHours);
router.put('/settings/bank-details', settingsController.updateBankDetails);
router.put('/settings/profile', settingsController.updateProfile);
router.post('/settings/change-password', settingsController.changePassword);

// Wallet & Payout
router.get('/wallet', settingsController.getWalletDetails);
router.post('/wallet/payout', settingsController.requestPayout);

module.exports = router;
