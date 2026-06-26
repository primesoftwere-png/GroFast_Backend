// models/DeliveryBoy/DeliveryBoyKYC.js
const mongoose = require('mongoose');

const DeliveryBoyKYCSchema = new mongoose.Schema({
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  aadharNumber: {
    type: String,
    required: true,
    minlength: 12,
    maxlength: 12
  },
  aadharFrontImage: {
    type: String,
    required: true
  },
  aadharBackImage: {
    type: String,
    required: true
  },
  drivingLicenseNumber: {
    type: String,
    required: true
  },
  drivingLicenseFrontImage: {
    type: String,
    required: true
  },
  drivingLicenseBackImage: {
    type: String,
    required: true
  },
  panNumber: {
    type: String,
    default: null,
    minlength: 10,
    maxlength: 10
  },
  panImage: {
    type: String,
    default: null
  },
  profilePhoto: {
    type: String,
    required: true
  },
  vehicleType: {
    type: String,
    required: true,
    enum: ['bike', 'scooter', 'bicycle', 'car']
  },
  vehicleNumber: {
    type: String,
    required: true
  },
  vehicleRCImage: {
    type: String,
    required: true
  },
  bankAccountNumber: {
    type: String,
    default: null
  },
  bankIFSC: {
    type: String,
    default: null
  },
  bankAccountHolderName: {
    type: String,
    default: null
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected']
  },
  rejectionReason: {
    type: String,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  submittedAt: {
    type: Date,
    default: Date.now
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
  collection: 'delivery_boy_kyc',
  timestamps: false
});

// Pre-save hook
DeliveryBoyKYCSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
DeliveryBoyKYCSchema.index({ status: 1 });

module.exports = mongoose.model('DeliveryBoyKYC', DeliveryBoyKYCSchema);
