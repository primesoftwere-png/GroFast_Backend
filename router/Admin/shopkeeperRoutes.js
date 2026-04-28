// router/Admin/shopkeeperRoutes.js (Updated: Added Test Route)
const express = require('express');
const { validateRegister, registerShop, testBody } = require('../../controllers/Admin/shopkeeperController');

const router = express.Router();

// Test route: POST /api/admin/shopkeeper/test-body (Send any JSON to verify parsing)
router.post('/test-body', testBody);

// Main route: POST /api/admin/shopkeeper/register
router.post('/register', validateRegister, registerShop);

module.exports = router;