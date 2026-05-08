// router/Shopkeeper/inventory.router.js
const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/shopkeeper/inventory.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// All routes require authentication
router.use(authMiddleware.userMiddlewere);

// Inventory management
router.get('/inventory', inventoryController.getInventory);
router.get('/inventory/low-stock', inventoryController.getLowStockProducts);
router.get('/inventory/out-of-stock', inventoryController.getOutOfStockProducts);
router.get('/inventory/logs', inventoryController.getInventoryLogs);

// Stock updates
router.put('/inventory/:productId/stock', inventoryController.updateStock);
router.post('/inventory/bulk-update', inventoryController.bulkUpdateStock);

module.exports = router;
