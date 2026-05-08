// models/DeliveryBoy/OrderOTP.js
const mongoose = require('mongoose');

const OrderOTPSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  otpType: {
    type: String,
    required: true,
    enum: ['pickup', 'delivery']
  },
  otp: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 6
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  collection: 'order_otps',
  timestamps: false
});

// Index for faster queries
OrderOTPSchema.index({ orderId: 1, otpType: 1 });
OrderOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Method to check if OTP is expired
OrderOTPSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt;
};

// Method to check if max attempts reached
OrderOTPSchema.methods.isMaxAttemptsReached = function() {
  return this.attempts >= this.maxAttempts;
};

module.exports = mongoose.model('OrderOTP', OrderOTPSchema);
