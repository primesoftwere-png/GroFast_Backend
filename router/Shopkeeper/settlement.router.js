// router/Shopkeeper/settlement.router.js
const express = require('express');
const router = express.Router();
const settlementController = require('../../controllers/shopkeeper/settlement.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// All routes require authentication
router.use(authMiddleware.userMiddlewere);

// Settlement requests
router.post('/settlement/request', settlementController.requestSettlement);

// Settlement history & details
router.get('/settlement/list', settlementController.getSettlements);
router.get('/settlement/summary', settlementController.getSettlementSummary);
router.get('/settlement/:settlementId', settlementController.getSettlementDetail);

// Settlement actions
router.post('/settlement/:settlementId/cancel', settlementController.cancelSettlement);

module.exports = router;
