// models/Shopkeeper.js (Shopkeeper Panel - Registration)
const mongoose = require('mongoose');

const ShopkeeperSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  shopName: { type: String, required: true, maxlength: 255 },
  ownerName: { type: String, required: true, maxlength: 255 },
  shopImage: { type: String, maxlength: 255 },
  licenseNumber: { type: String, maxlength: 100 },
  gstNumber: { type: String, maxlength: 50 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'shopkeepers',
  timestamps: false
});

ShopkeeperSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Shopkeeper', ShopkeeperSchema);