// models/PurchaseOrderItem.js (Shopkeeper Panel - Purchase Details)
const mongoose = require('mongoose');

const PurchaseOrderItemSchema = new mongoose.Schema({
  purchaseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'PurchaseOrder', 
    required: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 }
}, { 
  collection: 'purchase_order_items',
  timestamps: false
});

PurchaseOrderItemSchema.pre('save', function(next) {
  this.totalPrice = this.quantity * this.unitPrice;
  next();
});

module.exports = mongoose.model('PurchaseOrderItem', PurchaseOrderItemSchema);