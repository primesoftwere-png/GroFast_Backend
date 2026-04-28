// models/InventoryLog.js (Shopkeeper Panel - Stock Tracking)
const mongoose = require('mongoose');

const InventoryLogSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  transactionType: { 
    type: String, 
    required: true, 
    enum: ['purchase', 'sale', 'adjustment', 'return'] 
  },
  quantity: { type: Number, required: true },
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  referenceId: { type: Number },
  notes: { type: String },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  createdAt: { type: Date, default: Date.now }
}, { 
  collection: 'inventory_logs',
  timestamps: false
});

module.exports = mongoose.model('InventoryLog', InventoryLogSchema);