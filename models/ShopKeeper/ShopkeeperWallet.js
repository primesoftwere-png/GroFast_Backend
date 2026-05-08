// models/ShopKeeper/ShopkeeperWallet.js
const mongoose = require('mongoose');

const ShopkeeperWalletSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shopkeeper',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0
  },
  lastPayoutAt: {
    type: Date
  },
  currency: {
    type: String,
    default: 'INR'
  }
}, {
  timestamps: true
});

// Method to check if withdrawal is possible
ShopkeeperWalletSchema.methods.canWithdraw = function(amount) {
  return this.balance >= amount && amount > 0;
};

// Method to add earnings
ShopkeeperWalletSchema.methods.addEarnings = function(amount) {
  this.balance += amount;
  this.totalEarnings += amount;
};

// Method to process withdrawal
ShopkeeperWalletSchema.methods.processWithdrawal = function(amount) {
  if (!this.canWithdraw(amount)) {
    throw new Error('Insufficient balance');
  }
  this.balance -= amount;
  this.totalWithdrawn += amount;
  this.lastPayoutAt = new Date();
};

module.exports = mongoose.model('ShopkeeperWallet', ShopkeeperWalletSchema);
