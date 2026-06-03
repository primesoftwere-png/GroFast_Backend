// models/ShopKeeper/WithdrawRequest.js
const mongoose = require('mongoose');

const WithdrawRequestSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  bankName: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  upiId: { type: String },
  payoutType: {
    type: String,
    enum: ['bank', 'upi'],
    default: 'bank'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String },
  processedAt: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WithdrawRequest', WithdrawRequestSchema);
