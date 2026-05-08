// models/DeliveryBoy/DeliveryBoyNotification.js
const mongoose = require('mongoose');

const DeliveryBoyNotificationSchema = new mongoose.Schema({
  deliveryBoyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  type: {
    type: String,
    required: true,
    enum: ['order_assigned', 'order_cancelled', 'payment_received', 'settlement_approved', 'settlement_rejected', 'kyc_approved', 'kyc_rejected', 'account_blocked', 'account_unblocked', 'system', 'promotional']
  },
  priority: {
    type: String,
    default: 'normal',
    enum: ['low', 'normal', 'high', 'urgent']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  collection: 'delivery_boy_notifications',
  timestamps: false
});

// Index for faster queries
DeliveryBoyNotificationSchema.index({ deliveryBoyId: 1, createdAt: -1 });
DeliveryBoyNotificationSchema.index({ isRead: 1 });
DeliveryBoyNotificationSchema.index({ type: 1 });

module.exports = mongoose.model('DeliveryBoyNotification', DeliveryBoyNotificationSchema);
