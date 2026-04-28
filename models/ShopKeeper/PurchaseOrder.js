// models/PurchaseOrder.js (Shopkeeper Panel - Supplier Orders)
const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema({
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop', 
    required: true 
  },
  supplierName: {type: String, maxlength: 255 },
  supplierContact: { type: String, maxlength: 15 },
  totalAmount: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, required: true },
  notes: { type: String },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'purchase_orders',
  timestamps: false
});

PurchaseOrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);