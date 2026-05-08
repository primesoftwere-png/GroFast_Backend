// models/ShopReview.js (Customer Panel - Submit Review)
const mongoose = require('mongoose');

const ShopReviewSchema = new mongoose.Schema({
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop', 
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
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  reviewText: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'shop_reviews',
  timestamps: false
});

ShopReviewSchema.index({ shopId: 1, customerId: 1, orderId: 1 }, { unique: true });

ShopReviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ShopReview', ShopReviewSchema);