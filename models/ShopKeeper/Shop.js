// models/Shop.js (Shopkeeper Panel - Shop Management)
const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  shopkeeperId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shopkeeper', 
    required: true 
  },
  shopName: { type: String, required: true, maxlength: 255 },
  shopAddress: { type: String, required: true, maxlength: 500 },
  city: { type: String, required: true, maxlength: 100 },
  state: { type: String, required: true, maxlength: 100 },
  pincode: { type: String, required: true, maxlength: 10 },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  openingTime: { type: String },
  closingTime: { type: String },
  isOpen: { type: Boolean, default: true },
  rating: { type: Number, default: 0.00, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  status: { 
    type: String, 
    default: 'active', 
    enum: ['active', 'inactive', 'suspended'] 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'shops',
  timestamps: false
});

ShopSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Shop', ShopSchema);