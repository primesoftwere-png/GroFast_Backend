// models/Coupon.js (Customer Panel - Offers)
const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  couponCode: { type: String, required: true, unique: true, uppercase: true, maxlength: 50 },
  couponType: { 
    type: String, 
    required: true, 
    enum: ['percentage', 'flat'] 
  },
  discountValue: { type: Number, required: true, min: 0 },
  maxDiscountAmount: { type: Number, min: 0 },
  minOrderAmount: { type: Number, default: 0.00, min: 0 },
  usageLimit: { type: Number },
  usageCount: { type: Number, default: 0 },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  status: { 
    type: String, 
    default: 'active', 
    enum: ['active', 'inactive', 'expired'] 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'coupons',
  timestamps: false
});

CouponSchema.pre('save', function(next) {
  if (new Date() > this.validUntil) {
    this.status = 'expired';
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Coupon', CouponSchema);