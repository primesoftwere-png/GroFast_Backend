// models/DeliveryBoy/WalletTransaction.js
const mongoose = require('mongoose');

const WalletTransactionSchema = new mongoose.Schema({
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  transactionType: {
    type: String,
    required: true,
    enum: ['credit', 'debit', 'settlement', 'penalty', 'bonus', 'refund']
  },
  amount: {
    type: Number,
    required: true
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
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'cod', 'online', 'wallet', null],
    default: null
  },
  referenceNumber: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
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
  collection: 'wallet_transactions',
  timestamps: false
});

// Index for faster queries
WalletTransactionSchema.index({ deliveryBoyId: 1, createdAt: -1 });
WalletTransactionSchema.index({ orderId: 1 });
WalletTransactionSchema.index({ transactionType: 1 });

module.exports = mongoose.model('WalletTransaction', WalletTransactionSchema);
