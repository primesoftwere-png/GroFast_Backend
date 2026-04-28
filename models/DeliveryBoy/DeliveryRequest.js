// models/DeliveryRequest.js (Delivery Boy Panel - Assignment)
const mongoose = require('mongoose');

const DeliveryRequestSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true 
  },
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DeliveryBoy', 
    required: true 
  },
  requestStatus: { 
    type: String, 
    default: 'pending', 
    enum: ['pending', 'accepted', 'rejected', 'expired'] 
  },
  sentAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
  expiresAt: { type: Date, required: true }
}, { 
  collection: 'delivery_requests',
  timestamps: false
});

module.exports = mongoose.model('DeliveryRequest', DeliveryRequestSchema);