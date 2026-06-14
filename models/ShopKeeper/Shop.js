// models/Shop.js (Shopkeeper Panel - Shop Management)
const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  shopkeeperId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shopkeeper', 
    required: true 
  },
  shopName: { 
    type: String, 
    required: true, 
    maxlength: 255,
    trim: true
  },
  shopAddress: { 
    type: String, 
    required: true, 
    maxlength: 500,
    trim: true
  },
  city: { 
    type: String, 
    required: true, 
    maxlength: 100,
    trim: true
  },
  state: { 
    type: String, 
    required: true, 
    maxlength: 100,
    trim: true,
    default: 'Unknown'
  },
  pincode: { 
    type: String, 
    required: true, 
    maxlength: 10,
    trim: true
  },
  latitude: { 
    type: Number, 
    required: true, 
    min: -90, 
    max: 90 
  },
  longitude: { 
    type: Number, 
    required: true, 
    min: -180, 
    max: 180 
  },
  // Business Details
  businessType: {
    type: String,
    enum: ['grocery', 'pharmacy', 'restaurant', 'bakery', 'vegetables', 'fruits', 'dairy', 'other'],
    default: 'grocery'
  },
  openingTime: { 
    type: String,
    default: '09:00'
  },
  closingTime: { 
    type: String,
    default: '21:00'
  },
  isOpen: { 
    type: Boolean, 
    default: false 
  },
  // Media
  shopImage: {
    type: String, // URL to cloud storage
    trim: true
  },
  shopBanner: {
    type: String, // URL to cloud storage
    trim: true
  },
  // Ratings & Reviews
  rating: { 
    type: Number, 
    default: 0.00, 
    min: 0, 
    max: 5 
  },
  totalReviews: { 
    type: Number, 
    default: 0 
  },
  // Commission
  commissionRate: {
    type: Number,
    default: 10, // 10% default commission
    min: 0,
    max: 100
  },
  // Status Management
  status: { 
    type: String, 
    default: 'INACTIVE', 
    enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'] 
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  // Additional Info
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  collection: 'shops',
  timestamps: false
});

ShopSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for location-based queries
ShopSchema.index({ latitude: 1, longitude: 1 });
ShopSchema.index({ city: 1, status: 1 });
ShopSchema.index({ businessType: 1, status: 1 });

module.exports = mongoose.models.Shop || mongoose.model('Shop', ShopSchema);