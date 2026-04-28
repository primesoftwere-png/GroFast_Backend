const mongoose = require('mongoose');

const PurchaseOrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: mongoose.Types.Decimal128, required: true, min: 0 },
  totalPrice: { type: mongoose.Types.Decimal128, required: true, min: 0 }
}, { _id: false }); // Embedded schema without separate _id

const PurchaseOrderSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Equivalent to auto-increment pk
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  supplierName: { type: String, maxlength: 255 },
  supplierContact: { type: String, maxlength: 15 },
  totalAmount: { type: mongoose.Types.Decimal128, required: true, min: 0 },
  purchaseDate: { type: Date, required: true },
  notes: { type: String },
  items: [PurchaseOrderItemSchema], // Embedded array of items
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: false // Manual control over timestamps
});

// Indexes for performance
PurchaseOrderSchema.index({ shopId: 1 });
PurchaseOrderSchema.index({ purchaseDate: 1 });
PurchaseOrderSchema.index({ createdBy: 1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);