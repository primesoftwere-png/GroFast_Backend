// models/OrderItem.js (Customer Panel - Order Details)
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'product'
  },
  productName: { type: String, required: true, maxlength: 255 },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, default: 0.00, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 }
}, { 
  collection: 'order_items',
  timestamps: false
});

OrderItemSchema.pre('save', function(next) {
  this.totalPrice = this.quantity * this.unitPrice - this.discountAmount;
  next();
});

module.exports = mongoose.model('OrderItem', OrderItemSchema);