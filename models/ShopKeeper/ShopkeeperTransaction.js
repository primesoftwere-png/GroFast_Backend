// models/ShopKeeper/ShopkeeperTransaction.js
const mongoose = require('mongoose');

const ShopkeeperTransactionSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shopkeeper',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  settlementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShopkeeperSettlement',
    default: null
  },
  type: {
    type: String,
    required: true,
    enum: [
      'ORDER_CREDIT',        // Income from a delivered order
      'SETTLEMENT_DEBIT',    // Debit for bank/UPI settlement payout
      'PAYOUT_DEBIT',        // Debit for quick payout (legacy)
      'REFUND_DEBIT',        // Debit due to order refund
      'ADJUSTMENT_CREDIT',   // Manual credit adjustment by admin
      'ADJUSTMENT_DEBIT'     // Manual debit adjustment by admin
    ]
  },
  paymentMode: {
    type: String,
    required: true,
    enum: ['CASH', 'ONLINE', 'WALLET']
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformCommission: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    default: 'SUCCESS',
    enum: ['SUCCESS', 'PENDING', 'FAILED']
  },
  referenceId: {
    type: String,
    default: null,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'shopkeeper_transactions',
  timestamps: false
});

// Indexes for fast queries
ShopkeeperTransactionSchema.index({ shopkeeperId: 1, createdAt: -1 });
ShopkeeperTransactionSchema.index({ orderId: 1 });
ShopkeeperTransactionSchema.index({ settlementId: 1 });
ShopkeeperTransactionSchema.index({ type: 1 });
ShopkeeperTransactionSchema.index({ paymentMode: 1 });
ShopkeeperTransactionSchema.index({ shopkeeperId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('ShopkeeperTransaction', ShopkeeperTransactionSchema);
