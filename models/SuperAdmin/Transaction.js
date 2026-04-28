// models/Transaction.js (Super Admin - Finance Oversight)
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  transactionType: { 
    type: String, 
    required: true, 
    enum: ['order_payment', 'refund', 'commission', 'payout'] 
  },
  amount: { type: Number, required: true, min: 0 },
  paymentGateway: { type: String, maxlength: 50 },
  paymentId: { type: String, maxlength: 255 },
  status: { 
    type: String, 
    default: 'pending', 
    enum: ['pending', 'success', 'failed'] 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'transactions',
  timestamps: false
});

TransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Transaction', TransactionSchema);