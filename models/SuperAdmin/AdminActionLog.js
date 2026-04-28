// models/AdminActionLog.js (Super Admin - Audit)
const mongoose = require('mongoose');

const AdminActionLogSchema = new mongoose.Schema({
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  actionType: { 
    type: String, 
    required: true, 
    enum: ['user_activate', 'user_deactivate', 'user_block', 'category_approve', 'category_reject', 'shop_suspend'] 
  },
  targetType: { 
    type: String, 
    required: true, 
    enum: ['user', 'shop', 'category', 'product', 'order', 'system'] 
  },
  targetId: { type: Number },
  actionDetails: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { 
  collection: 'admin_actions_log',
  timestamps: false
});

module.exports = mongoose.model('AdminActionLog', AdminActionLogSchema);