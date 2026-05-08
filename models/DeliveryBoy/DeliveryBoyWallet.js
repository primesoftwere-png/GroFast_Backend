// models/DeliveryBoy/DeliveryBoyWallet.js
const mongoose = require('mongoose');

const DeliveryBoyWalletSchema = new mongoose.Schema({
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  balance: { 
    type: Number, 
    default: 0,
    required: true
  },
  codCollected: {
    type: Number,
    default: 0
  },
  codPending: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  codLimit: {
    type: Number,
    default: 10000, // Maximum COD amount delivery boy can hold
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String,
    default: null
  },
  lastSettlementDate: {
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
  collection: 'delivery_boy_wallets',
  timestamps: false
});

// Pre-save hook to update timestamp
DeliveryBoyWalletSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if delivery boy can accept COD orders
DeliveryBoyWalletSchema.methods.canAcceptCOD = function(orderAmount) {
  const potentialBalance = this.balance - orderAmount;
  return Math.abs(potentialBalance) <= this.codLimit;
};

// Method to check if wallet is within limit
DeliveryBoyWalletSchema.methods.isWithinLimit = function() {
  return Math.abs(this.balance) <= this.codLimit;
};

module.exports = mongoose.model('DeliveryBoyWallet', DeliveryBoyWalletSchema);
