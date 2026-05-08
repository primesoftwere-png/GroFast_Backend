// models/CouponUsage.js (Customer Panel - Coupon Apply)
const mongoose = require('mongoose');

const CouponUsageSchema = new mongoose.Schema({
  couponId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Coupon', 
    required: true 
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',  // Changed from 'Customer' to 'User'
    required: true 
  },
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  discountAmount: { type: Number, required: true, min: 0 },
  usedAt: { type: Date, default: Date.now }
}, { 
  collection: 'coupon_usage',
  timestamps: false
});

CouponUsageSchema.index({ couponId: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('CouponUsage', CouponUsageSchema);