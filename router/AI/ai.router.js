const express = require('express');
const router = express.Router();
const aiController = require('../../controllers/AI/ai.controller');
const authMiddleware = require('../../middlewere/user.middlewere'); // Assuming user is authenticated

// Route to get AI product suggestions based on cart and past orders
router.get('/suggest-products', authMiddleware.userMiddlewere, aiController.suggestProducts);

module.exports = router;
