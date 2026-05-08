// models/ShopKeeper/ShopkeeperBankDetails.js
const mongoose = require('mongoose');

const ShopkeeperBankDetailsSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shopkeeper',
    required: true,
    unique: true
  },
  accountHolderName: {
    type: String,
    required: true,
    trim: true
  },
  bankAccountNumber: {
    type: String,
    required: true,
    trim: true
  },
  ifscCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
      },
      message: 'Invalid IFSC code format'
    }
  },
  bankName: {
    type: String,
    trim: true
  },
  branchName: {
    type: String,
    trim: true
  },
  upiId: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[\w.-]+@[\w.-]+$/.test(v);
      },
      message: 'Invalid UPI ID format'
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ShopkeeperBankDetails', ShopkeeperBankDetailsSchema);
