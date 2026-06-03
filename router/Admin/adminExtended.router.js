// router/Admin/adminExtended.router.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/Admin/adminExtended.controller');
const authMiddleware = require('../../middlewere/user.middlewere');
const roleMiddleware = require('../../middlewere/role.middleware');

const auth = [authMiddleware.userMiddlewere, roleMiddleware.isSuperAdmin];

// ORDERS
router.get('/orders', ...auth, ctrl.getOrders);
router.get('/orders/:id', ...auth, ctrl.getOrderById);
router.put('/orders/:id/status', ...auth, ctrl.updateOrderStatus);
router.post('/orders/:id/assign-delivery', ...auth, ctrl.assignDelivery);
router.post('/orders/:id/cancel', ...auth, ctrl.cancelOrder);

// PRODUCTS
router.get('/products', ...auth, ctrl.getProducts);
router.get('/products/:id', ...auth, ctrl.getProductById);
router.delete('/products/:id', ...auth, ctrl.deleteProduct);

// CATEGORIES CRUD
router.post('/categories', ...auth, ctrl.createCategory);
router.put('/categories/:id', ...auth, ctrl.updateCategory);
router.delete('/categories/:id', ...auth, ctrl.deleteCategory);

// COUPONS
router.get('/coupons', ...auth, ctrl.getCoupons);
router.get('/coupons/:id', ...auth, ctrl.getCouponById);
router.post('/coupons', ...auth, ctrl.createCoupon);
router.put('/coupons/:id', ...auth, ctrl.updateCoupon);
router.delete('/coupons/:id', ...auth, ctrl.deleteCoupon);
router.post('/coupons/:id/activate', ...auth, ctrl.activateCoupon);
router.post('/coupons/:id/deactivate', ...auth, ctrl.deactivateCoupon);

// PAYMENTS
router.get('/payments', ...auth, ctrl.getPayments);
router.get('/payments/transactions', ...auth, ctrl.getTransactions);
router.get('/payments/:id', ...auth, ctrl.getPaymentById);
router.post('/payments/:id/refund', ...auth, ctrl.refundPayment);

// WALLETS
router.get('/wallets', ...auth, ctrl.getWallets);
router.get('/wallets/:id', ...auth, ctrl.getWalletById);
router.post('/wallets/:id/credit', ...auth, ctrl.creditWallet);
router.post('/wallets/:id/debit', ...auth, ctrl.debitWallet);
router.get('/wallets/:id/transactions', ...auth, ctrl.getWalletTransactions);

// WITHDRAW REQUESTS
router.get('/withdraw-requests', ...auth, ctrl.getWithdrawRequests);
router.get('/withdraw-requests/:id', ...auth, ctrl.getWithdrawRequestById);
router.post('/withdraw-requests/:id/approve', ...auth, ctrl.approveWithdraw);
router.post('/withdraw-requests/:id/reject', ...auth, ctrl.rejectWithdraw);

// REPORTS
router.get('/reports/sales', ...auth, ctrl.getSalesReport);
router.get('/reports/revenue', ...auth, ctrl.getRevenueReport);
router.get('/reports/orders', ...auth, ctrl.getOrdersReport);
router.get('/reports/users', ...auth, ctrl.getUsersReport);
router.get('/reports/export', ...auth, ctrl.exportReport);

// SETTINGS
router.get('/settings', ...auth, ctrl.getSettings);
router.put('/settings', ...auth, ctrl.updateSettings);
router.get('/settings/general', ...auth, ctrl.getGeneralSettings);
router.put('/settings/payment', ...auth, ctrl.updatePaymentSettings);
router.put('/settings/notification', ...auth, ctrl.updateNotificationSettings);

// SUPPORT TICKETS
router.get('/support/tickets', ...auth, ctrl.getTickets);
router.post('/support/tickets', ...auth, ctrl.createTicket);
router.get('/support/tickets/:id', ...auth, ctrl.getTicketById);
router.post('/support/tickets/:id/reply', ...auth, ctrl.replyToTicket);
router.post('/support/tickets/:id/close', ...auth, ctrl.closeTicket);

console.log('✅ Admin Extended routes loaded');
module.exports = router;
