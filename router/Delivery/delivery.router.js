const Delivery = require('../../controllers/Delivery/delivery.controller');
const authMiddleware = require('../../middlewere/user.middlewere');
const express = require('express');
const router = express.Router();


router.put('/updateStatus/:deliveryId',authMiddleware.userMiddlewere,Delivery.updateDeliveryBoyStatus);

module.exports = router;