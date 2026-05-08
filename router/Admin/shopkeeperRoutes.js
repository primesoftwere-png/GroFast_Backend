// router/Admin/shopkeeperRoutes.js
const express = require('express');
const { registerShopkeeper } = require('../../controllers/Admin/shopkeeperRegister');
const { validateRegister, registerShop, testBody, testDatabase } = require('../../controllers/Admin/shopkeeperController');

const router = express.Router();

// Test routes
router.post('/test-body', testBody);
router.get('/test-db', testDatabase);

// MAIN REGISTRATION ENDPOINT - USE THIS
router.post('/register', registerShopkeeper);

// Old endpoints (backup)
router.post('/register-old', validateRegister, registerShop);

module.exports = router;