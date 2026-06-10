const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/Customer/order.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// Debug logging
console.log('✅ Order router loaded');

// ==================== NEW REAL-TIME ORDER FLOW ROUTES ====================
// 1. Create Order (API)
router.post('/create', authMiddleware.userMiddlewere, orderController.createOrder);
router.post('/convert-cart-to-order', authMiddleware.userMiddlewere, orderController.createOrder);

// 2. Get Customer Orders
router.get('/my-orders', authMiddleware.userMiddlewere, orderController.getCustomerOrders);

// 3. Get Order Details
router.get('/:orderId', authMiddleware.userMiddlewere, orderController.getOrderDetails);

// 4. Track Delivery Boy
router.get('/:orderId/track', authMiddleware.userMiddlewere, orderController.trackDelivery);

console.log('✅ Real-time order flow routes registered:');
console.log('   - POST /create - Create new order');
console.log('   - GET /my-orders - Get customer orders');
console.log('   - GET /:orderId - Get order details');
console.log('   - GET /:orderId/track - Track delivery boy location');

module.exports = router;