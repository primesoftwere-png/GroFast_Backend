// models/DeliveryBoy/Settlement.js
const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema({
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  settlementNumber: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'upi', 'bank_transfer']
  },
  referenceNumber: {
    type: String,
    default: null
  },
  proofImage: {
    type: String,
    default: null
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected']
  },
  remarks: {
    type: String,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
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
  collection: 'settlements',
  timestamps: false
});

// Pre-save hook
SettlementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
SettlementSchema.index({ deliveryBoyId: 1, createdAt: -1 });
SettlementSchema.index({ status: 1 });

module.exports = mongoose.model('Settlement', SettlementSchema);
