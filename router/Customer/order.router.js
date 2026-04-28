const express = require('express');
const router = express.Router();
const { placeOrder, getOrderById, convertCartToOrder } = require('../../controllers/Customer/order.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// Convert cart to order with auto-generated order number
router.post('/cart-to-order', authMiddleware.userMiddlewere, convertCartToOrder);

router.post('/placeOrder', placeOrder);
router.get('/getOrder/:placeOrderId', getOrderById);

module.exports = router;