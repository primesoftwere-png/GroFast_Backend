// router/Shopkeeper/order.router.js
const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/shopkeeper/shopkeeperOrder.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// All routes require authentication
router.use(authMiddleware.userMiddlewere);

// Order management
router.get('/orders', orderController.getOrders);
router.get('/orders/pending', orderController.getPendingOrders);
router.get('/orders/stats', orderController.getOrderStats);
router.get('/orders/:orderId', orderController.getOrderDetails);

// Order actions
router.post('/orders/accept', orderController.acceptOrder);
router.post('/orders/ready', orderController.markReadyForPickup);
router.post('/orders/cancel', orderController.cancelOrder);

module.exports = router;
