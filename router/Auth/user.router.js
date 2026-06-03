const express = require("express");
const router = express.Router();
const userController = require("../../controllers/Auth/user.controller");
const authMiddleware = require("../../middlewere/user.middlewere");

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password/:token", userController.resetPassword);
router.put(
  "/update-address",
  authMiddleware.userMiddlewere,
  userController.updateAddress
);
router.get("/profile", authMiddleware.userMiddlewere, userController.profile);
router.get("/logout", authMiddleware.userMiddlewere, userController.logout);

// Google Auth & OTP Login
router.post("/google-login", userController.googleLogin);
router.post("/send-otp", userController.sendOtp);
router.post("/verify-otp", userController.verifyOtp);

router.post("/change-password", authMiddleware.userMiddlewere, userController.changePassword);

module.exports = router;
