// models/Notification.js (Customer Panel - Alerts)
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  notificationType: { 
    type: String, 
    required: true, 
    enum: ['order', 'delivery', 'message', 'promotion', 'system'] 
  },
  title: { type: String, required: true, maxlength: 255 },
  body: { type: String, required: true },
  dataJson: { type: String },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date }
}, { 
  collection: 'notifications',
  timestamps: false
});

module.exports = mongoose.model('Notification', NotificationSchema);