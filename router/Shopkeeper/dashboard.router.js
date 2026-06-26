// router/Shopkeeper/dashboard.router.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/shopkeeper/dashboard.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// Dashboard endpoints
router.get('/dashboard', authMiddleware.userMiddlewere, dashboardController.getDashboardData);

module.exports = router;
