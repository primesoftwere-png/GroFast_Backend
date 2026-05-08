// models/DeliveryReview.js (Customer Panel - Delivery Feedback)
const mongoose = require('mongoose');

const DeliveryReviewSchema = new mongoose.Schema({
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DeliveryBoy', 
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
  collection: 'delivery_reviews',
  timestamps: false
});

DeliveryReviewSchema.index({ deliveryBoyId: 1, customerId: 1, orderId: 1 }, { unique: true });

DeliveryReviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DeliveryReview', DeliveryReviewSchema);