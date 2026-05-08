// models/ShopKeeper/ShopkeeperKYC.js
const mongoose = require('mongoose');

const ShopkeeperKYCSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shopkeeper',
    required: true,
    unique: true
  },
  // Owner & KYC Details
  ownerNameAsPerID: {
    type: String,
    required: true,
    trim: true
  },
  aadhaarNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{12}$/.test(v);
      },
      message: 'Aadhaar number must be 12 digits'
    }
  },
  aadhaarDocument: {
    type: String, // URL to cloud storage
    required: true
  },
  panNumber: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
      },
      message: 'Invalid PAN number format'
    }
  },
  panDocument: {
    type: String // URL to cloud storage
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return !v || /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(v);
      },
      message: 'Invalid GST number format'
    }
  },
  gstDocument: {
    type: String // URL to cloud storage
  },
  // KYC Status
  kycStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ShopkeeperKYC', ShopkeeperKYCSchema);
