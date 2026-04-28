// models/OrderStatusHistory.js (Shopkeeper Panel - Order Updates)
const mongoose = require('mongoose');

const OrderStatusHistorySchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'] 
  },
  notes: { type: String },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  createdAt: { type: Date, default: Date.now }
}, { 
  collection: 'order_status_history',
  timestamps: false
});

module.exports = mongoose.model('OrderStatusHistory', OrderStatusHistorySchema);