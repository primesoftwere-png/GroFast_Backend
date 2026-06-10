// models/ShopKeeper/ShopkeeperSettlement.js
const mongoose = require('mongoose');

const ShopkeeperSettlementSchema = new mongoose.Schema({
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shopkeeper',
    required: true
  },
  settlementNumber: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['BANK_TRANSFER', 'UPI_TRANSFER', 'CASH_COLLECTION']
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformFee: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    default: 'PENDING',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']
  },
  // Snapshot of bank details at time of settlement
  bankDetails: {
    accountHolderName: { type: String },
    bankAccountNumber: { type: String },
    ifscCode: { type: String },
    bankName: { type: String },
    upiId: { type: String }
  },
  utrNumber: {
    type: String,
    default: null,
    trim: true
  },
  // Settlement period — date range covered
  settlementPeriod: {
    from: { type: Date },
    to: { type: Date }
  },
  // Orders included in this settlement
  orderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: null,
    trim: true
  },
  remarks: {
    type: String,
    default: null,
    trim: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  collection: 'shopkeeper_settlements',
  timestamps: false
});

// Pre-save hook
ShopkeeperSettlementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
ShopkeeperSettlementSchema.index({ shopkeeperId: 1, createdAt: -1 });
ShopkeeperSettlementSchema.index({ status: 1 });
ShopkeeperSettlementSchema.index({ shopkeeperId: 1, status: 1, createdAt: -1 });

// Static method to generate settlement number
ShopkeeperSettlementSchema.statics.generateSettlementNumber = async function() {
  const count = await this.countDocuments();
  const timestamp = Date.now().toString().slice(-8);
  return `STL-${timestamp}-${(count + 1).toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('ShopkeeperSettlement', ShopkeeperSettlementSchema);
