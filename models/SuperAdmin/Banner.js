// models/Banner.js (Super Admin - Promotions)
const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  bannerTitle: { type: String, required: true, maxlength: 255 },
  bannerImage: { type: String, required: true, maxlength: 255 },
  bannerType: { 
    type: String, 
    enum: ['main_slider', 'category_banner', 'offer_banner'] 
  },
  targetType: { 
    type: String, 
    enum: ['category', 'product', 'shop', 'external_link'] 
  },
  targetId: { type: Number },
  targetUrl: { type: String, maxlength: 500 },
  displayOrder: { type: Number, default: 0 },
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
  collection: 'banners',
  timestamps: false
});

BannerSchema.pre('save', function(next) {
  if (this.validUntil && new Date() > this.validUntil) {
    this.status = 'inactive';
  }
  this.updatedAt = Date.now();
  next();
});

BannerSchema.index({ displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model('Banner', BannerSchema);