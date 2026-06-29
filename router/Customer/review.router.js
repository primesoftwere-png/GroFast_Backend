const express = require('express');
const router = express.Router();
const reviewController = require('../../controllers/Customer/review.controller');
const authMiddleware = require('../../middlewere/user.middlewere');

// POST /api/review/:orderToken
// Customer submits a review for delivery boy and products related to an order
router.post('/:orderToken', authMiddleware.userMiddlewere, reviewController.submitReview);

module.exports = router;
