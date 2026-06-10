// router/Shopkeeper/income.router.js
const express = require('express');
const router = express.Router();
const incomeController = require('../../controllers/shopkeeper/income.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// All routes require authentication
router.use(authMiddleware.userMiddlewere);

// Income recording
router.post('/income/record', incomeController.recordOrderIncome);

// Income analytics & overview
router.get('/income/overview', incomeController.getIncomeOverview);
router.get('/income/daily', incomeController.getDailyIncome);
router.get('/income/by-payment-mode', incomeController.getIncomeByPaymentMode);

// Transaction history
router.get('/income/transactions', incomeController.getTransactionHistory);
router.get('/income/transactions/:transactionId', incomeController.getTransactionDetail);

module.exports = router;
