// models/Order.js (Customer Panel - Order History)
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const OrderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `ORD-${Date.now()}-${uuidv4().toUpperCase().slice(0, 6)}`
  },
  orderToken: {
    type: String,
    unique: true,
    required: true
  },
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  deliveryBoyAssignedAt: { type: Date },
  deliveryAddressId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CustomerAddress', 
    required: true 
  },
  
  // Order Status - Updated to match exact flow
  orderStatus: { 
    type: String, 
    default: 'PENDING', 
    enum: [
      'PENDING',        // Initial state after order creation
      'CONFIRMED',      // Shopkeeper accepted
      'ASSIGNED',       // Delivery boy assigned
      'PICKED_UP',      // Delivery boy picked up (OTP verified)
      'IN_TRANSIT',     // On the way to customer
      'DELIVERED',      // Successfully delivered
      'CANCELLED'       // Order cancelled
    ] 
  },
  
  // Payment Details
  paymentStatus: { 
    type: String, 
    default: 'PENDING', 
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] 
  },
  paymentMethod: { 
    type: String, 
    required: true, 
    enum: ['COD', 'ONLINE', 'WALLET'] 
  },
  
  // Pricing
  subtotal: { type: Number, required: true, min: 0 },
  deliveryCharge: { type: Number, default: 0.00, min: 0 },
  discountAmount: { type: Number, default: 0.00, min: 0 },
  taxAmount: { type: Number, default: 0.00, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  codAmount: { type: Number, default: 0, min: 0 },
  
  // OTP for Pickup (Delivery boy verifies at shop)
  otp: { 
    type: String,
    default: () => Math.floor(1000 + Math.random() * 9000).toString() // 4-digit OTP
  },
  otpVerified: { 
    type: Boolean, 
    default: false 
  },
  
  // Legacy OTP fields (keeping for backward compatibility)
  pickupOTP: {
    code: { type: String },
    expiresAt: { type: Date },
    verified: { type: Boolean, default: false }
  },
  deliveryOTP: {
    code: { type: String },
    expiresAt: { type: Date },
    verified: { type: Boolean, default: false }
  },
  
  // Addresses
  pickupAddress: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }
  },
  deliveryAddress: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }
  },
  
  // Additional Info
  specialInstructions: { type: String },
  cancellationReason: { type: String },
  rejectionReason: { type: String },
  
  // Timestamps
  estimatedDeliveryTime: { type: Date },
  acceptedAt: { type: Date },
  readyForPickupAt: { type: Date },
  pickedUpAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'orders',
  timestamps: true
});

OrderSchema.pre('save', function(next) {
  this.totalAmount = this.subtotal + this.deliveryCharge + this.taxAmount - this.discountAmount;
  
  // Set COD amount if payment method is COD
  if (this.paymentMethod === 'COD') {
    this.codAmount = this.totalAmount;
  }
  
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', OrderSchema);