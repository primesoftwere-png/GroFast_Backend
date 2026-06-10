// models/Shopkeeper/ShopAdvertisement.js
const mongoose = require('mongoose');

const ShopAdvertisementSchema = new mongoose.Schema({
  shopkeeperId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shopkeeper', 
    required: true 
  },
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop'
  },
  title: { 
    type: String, 
    required: true, 
    maxlength: 255 
  },
  image: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['banner', 'ad'],
    default: 'banner'
  },
  targetUrl: { 
    type: String, 
    maxlength: 500 
  },
  status: { 
    type: String, 
    default: 'active', 
    enum: ['active', 'inactive'] 
  },
  validFrom: { type: Date },
  validUntil: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'shop_advertisements',
  timestamps: false
});

ShopAdvertisementSchema.pre('save', function(next) {
  if (this.validUntil && new Date() > this.validUntil) {
    this.status = 'inactive';
  }
  this.updatedAt = Date.now();
  next();
});

ShopAdvertisementSchema.index({ shopkeeperId: 1, status: 1 });
ShopAdvertisementSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('ShopAdvertisement', ShopAdvertisementSchema);
