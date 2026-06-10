// models/ShopKeeper/ShopkeeperDailyIncome.js
const mongoose = require('mongoose');

const ShopkeeperDailyIncomeSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shopkeeper',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  // Income by payment mode
  cashIncome: {
    type: Number,
    default: 0,
    min: 0
  },
  onlineIncome: {
    type: Number,
    default: 0,
    min: 0
  },
  walletIncome: {
    type: Number,
    default: 0,
    min: 0
  },
  totalIncome: {
    type: Number,
    default: 0,
    min: 0
  },
  // Order counts by payment mode
  cashOrderCount: {
    type: Number,
    default: 0,
    min: 0
  },
  onlineOrderCount: {
    type: Number,
    default: 0,
    min: 0
  },
  walletOrderCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalOrderCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Commission & net income
  platformCommission: {
    type: Number,
    default: 0,
    min: 0
  },
  netIncome: {
    type: Number,
    default: 0,
    min: 0
  },
  // Average order value
  averageOrderValue: {
    type: Number,
    default: 0,
    min: 0
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
  collection: 'shopkeeper_daily_income',
  timestamps: false
});

// Pre-save hook to compute derived fields
ShopkeeperDailyIncomeSchema.pre('save', function(next) {
  this.totalIncome = this.cashIncome + this.onlineIncome + this.walletIncome;
  this.totalOrderCount = this.cashOrderCount + this.onlineOrderCount + this.walletOrderCount;
  this.netIncome = this.totalIncome - this.platformCommission;
  this.averageOrderValue = this.totalOrderCount > 0 
    ? Math.round((this.totalIncome / this.totalOrderCount) * 100) / 100 
    : 0;
  this.updatedAt = Date.now();
  next();
});

// Compound unique index — one record per shopkeeper per day
ShopkeeperDailyIncomeSchema.index({ shopkeeperId: 1, date: 1 }, { unique: true });
ShopkeeperDailyIncomeSchema.index({ shopkeeperId: 1, date: -1 });

module.exports = mongoose.model('ShopkeeperDailyIncome', ShopkeeperDailyIncomeSchema);
