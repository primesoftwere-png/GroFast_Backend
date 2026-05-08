// models/DeliveryBoy/DeliveryBoyIssue.js
const mongoose = require('mongoose');

const DeliveryBoyIssueSchema = new mongoose.Schema({
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
  issueType: {
    type: String,
    required: true,
    enum: ['order_issue', 'payment_issue', 'customer_issue', 'vehicle_breakdown', 'accident', 'app_issue', 'other']
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  priority: {
    type: String,
    default: 'normal',
    enum: ['low', 'normal', 'high', 'urgent']
  },
  status: {
    type: String,
    default: 'open',
    enum: ['open', 'in_progress', 'resolved', 'closed']
  },
  attachments: [{
    type: String
  }],
  resolution: {
    type: String,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  collection: 'delivery_boy_issues',
  timestamps: false
});

// Pre-save hook
DeliveryBoyIssueSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
DeliveryBoyIssueSchema.index({ deliveryBoyId: 1, createdAt: -1 });
DeliveryBoyIssueSchema.index({ status: 1 });
DeliveryBoyIssueSchema.index({ orderId: 1 });

module.exports = mongoose.model('DeliveryBoyIssue', DeliveryBoyIssueSchema);
