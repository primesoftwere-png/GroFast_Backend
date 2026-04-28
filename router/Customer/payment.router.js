const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewere/user.middlewere");
const PaymentController = require("../../controllers/Customer/payment.controller");

router.post("/create-payment-intent", authMiddleware.userMiddlewere, PaymentController.createPaymentIntent);
router.get("/get-key", authMiddleware.userMiddlewere, PaymentController.getKey);
router.post("/verify-payment", authMiddleware.userMiddlewere, PaymentController.verifyPayment);

module.exports = router;    