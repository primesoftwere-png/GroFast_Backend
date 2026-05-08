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
  dateOfBirth: { type: Date, default: null },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other', null],
    default: null
  },
  address: {
    street: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    pincode: { type: String, default: null }
  },
  emergencyContact: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    relation: { type: String, default: null }
  },
  vehicleType: { 
    type: String, 
    required: true, 
    enum: ['bike', 'scooter', 'bicycle', 'car'] 
  },
  vehicleNumber: { type: String, required: true, maxlength: 50 },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  isAvailable: { 
    type: Boolean, 
    default: true 
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String,
    default: null
  },
  rating: { 
    type: Number, 
    default: 0.00, 
    min: 0, 
    max: 5 
  },
  totalDeliveries: { 
    type: Number, 
    default: 0 
  },
  completedDeliveries: {
    type: Number,
    default: 0
  },
  cancelledDeliveries: {
    type: Number,
    default: 0
  },
  activeOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  lastActiveAt: {
    type: Date,
    default: null
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  collection: 'delivery_boys',
  timestamps: false
});

DeliveryBoySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
DeliveryBoySchema.index({ userId: 1 });
DeliveryBoySchema.index({ isOnline: 1, isAvailable: 1 });
DeliveryBoySchema.index({ isBlocked: 1 });

module.exports = mongoose.model('DeliveryBoy', DeliveryBoySchema);