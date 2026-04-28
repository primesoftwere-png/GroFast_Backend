// models/Order.js (Customer Panel - Order History)
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const OrderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `ORD-${uuidv4().toUpperCase().slice(0, 8)}`
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop', 
    required: true 
  },
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DeliveryBoy' 
  },
  deliveryAddressId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CustomerAddress', 
    required: true 
  },
  orderStatus: { 
    type: String, 
    default: 'pending', 
    enum: ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'] 
  },
  paymentStatus: { 
    type: String, 
    default: 'pending', 
    enum: ['pending', 'paid', 'failed', 'refunded'] 
  },
  paymentMethod: { 
    type: String, 
    required: true, 
    enum: ['cod', 'online', 'wallet'] 
  },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryCharge: { type: Number, default: 0.00, min: 0 },
  discountAmount: { type: Number, default: 0.00, min: 0 },
  taxAmount: { type: Number, default: 0.00, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  specialInstructions: { type: String },
  cancellationReason: { type: String },
  rejectionReason: { type: String },
  estimatedDeliveryTime: { type: Date },
  confirmedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'orders',
  timestamps: false
});

OrderSchema.pre('save', function(next) {
  this.totalAmount = this.subtotal + this.deliveryCharge + this.taxAmount - this.discountAmount;
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', OrderSchema);