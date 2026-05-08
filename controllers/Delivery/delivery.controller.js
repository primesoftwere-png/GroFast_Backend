// controllers/Delivery/delivery.controller.js
// Main delivery controller - exports all delivery controllers

// Import all delivery controllers
const deliveryAuth = require('./deliveryAuth.controller');
const deliveryProfile = require('./deliveryProfile.controller');
const deliveryAvailability = require('./deliveryAvailability.controller');
const deliveryOrder = require('./deliveryOrder.controller');
const deliveryOrderStatus = require('./deliveryOrderStatus.controller');
const deliveryLocation = require('./deliveryLocation.controller');
const deliveryWallet = require('./deliveryWallet.controller');
const deliverySettlement = require('./deliverySettlement.controller');
const deliveryNotification = require('./deliveryNotification.controller');
const deliveryIssue = require('./deliveryIssue.controller');

// Export all controllers
module.exports = {
  // Authentication
  ...deliveryAuth,
  
  // Profile & KYC
  ...deliveryProfile,
  
  // Availability
  ...deliveryAvailability,
  
  // Order Management
  ...deliveryOrder,
  
  // Order Status Flow
  ...deliveryOrderStatus,
  
  // Location
  ...deliveryLocation,
  
  // Wallet
  ...deliveryWallet,
  
  // Settlement
  ...deliverySettlement,
  
  // Notifications
  ...deliveryNotification,
  
  // Issues
  ...deliveryIssue
};