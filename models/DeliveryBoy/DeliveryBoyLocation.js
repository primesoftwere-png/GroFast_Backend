// models/DeliveryBoy/DeliveryBoyLocation.js
const mongoose = require('mongoose');

const DeliveryBoyLocationSchema = new mongoose.Schema({
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
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
  accuracy: {
    type: Number,
    default: null
  },
  speed: {
    type: Number,
    default: null
  },
  heading: {
    type: Number,
    default: null
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      default: [0, 0]
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  locationHistory: [{
    latitude: Number,
    longitude: Number,
    speed: Number,
    heading: Number,
    timestamp: { type: Date, default: Date.now }
  }]
}, { 
  collection: 'delivery_boy_locations',
  timestamps: false
});

// Index for geospatial queries
DeliveryBoyLocationSchema.index({ 
  location: '2dsphere' 
});

DeliveryBoyLocationSchema.index({ 
  orderId: 1 
});

// Pre-save hook
DeliveryBoyLocationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DeliveryBoyLocation', DeliveryBoyLocationSchema);
