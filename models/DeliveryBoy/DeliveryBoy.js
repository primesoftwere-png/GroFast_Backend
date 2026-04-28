// models/DeliveryBoy.js (Delivery Boy Panel - Profile)
const mongoose = require('mongoose');

const DeliveryBoySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  firstName: { type: String, required: true, maxlength: 100 },
  lastName: { type: String, maxlength: 100 },
  profileImage: { type: String, maxlength: 255 },
  licenseNumber: { type: String, maxlength: 100 },
  vehicleType: { 
    type: String, 
    required: true, 
    enum: ['bike', 'scooter', 'bicycle', 'car'] 
  },
  vehicleNumber: { type: String, required: true, maxlength: 50 },
  aadharNumber: { type: String, maxlength: 12 },
  currentLatitude: { type: Number, min: -90, max: 90 },
  currentLongitude: { type: Number, min: -180, max: 180 },
  isAvailable: { type: Boolean, default: true },
  rating: { type: Number, default: 0.00, min: 0, max: 5 },
  totalDeliveries: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'delivery_boys',
  timestamps: false
});

DeliveryBoySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DeliveryBoy', DeliveryBoySchema);