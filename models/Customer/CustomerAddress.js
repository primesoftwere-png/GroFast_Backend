// models/CustomerAddress.js (Customer Panel - Delivery)
const mongoose = require('mongoose');

const CustomerAddressSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',  // Changed from 'Customer' to 'User'
    required: true 
  },
  addressType: { 
    type: String, 
    default: 'home', 
    enum: ['home', 'work', 'other'] 
  },
  addressLine1: { type: String, required: true, maxlength: 255 },
  addressLine2: { type: String, maxlength: 255 },
  landmark: { type: String, maxlength: 255 },
  city: { type: String, required: true, maxlength: 100 },
  state: { type: String, required: true, maxlength: 100 },
  pincode: { type: String, required: true, maxlength: 10 },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  lan: { type: Number },
  lng: { type: Number },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'customer_addresses',
  timestamps: false
});

CustomerAddressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CustomerAddress', CustomerAddressSchema);