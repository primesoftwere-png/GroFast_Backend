const express = require('express');
const router = express.Router();
const shopAdvertisementController = require('../../controllers/Customer/shopAdvertisement.controller');
const { verifyCustomer } = require('../../middlewere/user.middlewere'); // Using existing user middleware if required, else might be public

// Assuming ads can be viewed by customers (authenticated or public)
// We'll use verifyCustomer if you want it to be authenticated only. For now, let's keep it public or use middleware if required.
// We'll leave out verifyCustomer to let anyone see ads, or you can add it if required.
router.get('/list', shopAdvertisementController.getActiveAds);

module.exports = router;
