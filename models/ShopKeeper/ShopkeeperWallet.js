// models/ShopKeeper/ShopkeeperWallet.js
const mongoose = require('mongoose');

const ShopkeeperWalletSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shopkeeper',
    required: true,
    unique: true
  },
  // Overall balance (cash + online combined)
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
  },
  // ===== Cash vs Online balance split =====
  cashBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  onlineBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  walletBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  // ===== Earnings breakdown =====
  totalCashEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalOnlineEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWalletEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  // ===== Commission & settlement tracking =====
  totalPlatformCommission: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSettled: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingSettlementAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // ===== Configuration =====
  minimumPayoutAmount: {
    type: Number,
    default: 100
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Method to check if withdrawal is possible
ShopkeeperWalletSchema.methods.canWithdraw = function(amount) {
  return this.balance >= amount && amount > 0;
};

// Method to add earnings (legacy — keeps backward compatibility)
ShopkeeperWalletSchema.methods.addEarnings = function(amount) {
  this.balance += amount;
  this.totalEarnings += amount;
};

// Method to add cash earnings (COD orders)
ShopkeeperWalletSchema.methods.addCashEarnings = function(amount, commission = 0) {
  const netAmount = amount - commission;
  this.balance += netAmount;
  this.cashBalance += netAmount;
  this.totalEarnings += netAmount;
  this.totalCashEarnings += netAmount;
  this.totalPlatformCommission += commission;
};

// Method to add online earnings (online payment orders)
ShopkeeperWalletSchema.methods.addOnlineEarnings = function(amount, commission = 0) {
  const netAmount = amount - commission;
  this.balance += netAmount;
  this.onlineBalance += netAmount;
  this.totalEarnings += netAmount;
  this.totalOnlineEarnings += netAmount;
  this.totalPlatformCommission += commission;
};

// Method to add wallet earnings (wallet payment orders)
ShopkeeperWalletSchema.methods.addWalletEarnings = function(amount, commission = 0) {
  const netAmount = amount - commission;
  this.balance += netAmount;
  this.walletBalance += netAmount;
  this.totalEarnings += netAmount;
  this.totalWalletEarnings += netAmount;
  this.totalPlatformCommission += commission;
};

// Method to process settlement (bank/UPI payout)
ShopkeeperWalletSchema.methods.processSettlement = function(amount) {
  if (!this.canWithdraw(amount)) {
    throw new Error('Insufficient balance for settlement');
  }
  this.balance -= amount;
  this.totalSettled += amount;
  this.totalWithdrawn += amount;
  this.lastPayoutAt = new Date();
};

// Method to process withdrawal (legacy — keeps backward compatibility)
ShopkeeperWalletSchema.methods.processWithdrawal = function(amount) {
  if (!this.canWithdraw(amount)) {
    throw new Error('Insufficient balance');
  }
  this.balance -= amount;
  this.totalWithdrawn += amount;
  this.lastPayoutAt = new Date();
};

// Method to reverse a settlement (when cancelled)
ShopkeeperWalletSchema.methods.reverseSettlement = function(amount) {
  this.balance += amount;
  this.totalSettled -= amount;
  this.totalWithdrawn -= amount;
};

module.exports = mongoose.model('ShopkeeperWallet', ShopkeeperWalletSchema);
