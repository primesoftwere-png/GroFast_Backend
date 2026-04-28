// models/Message.js (Customer Panel - Chat/Support)
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  messageType: { 
    type: String, 
    required: true, 
    enum: ['notification', 'order_update', 'system', 'admin_broadcast'] 
  },
  title: { type: String, maxlength: 255 },
  messageText: { type: String, required: true },
  referenceType: { 
    type: String, 
    enum: ['order', 'product', 'category_request', 'general'] 
  },
  referenceId: { type: Number },
  isRead: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now },
  readAt: { type: Date }
}, { 
  collection: 'messages',
  timestamps: false
});

module.exports = mongoose.model('Message', MessageSchema);