// models/CategoryRequest.js (Shared - Shopkeeper Request, Admin Approve)
const mongoose = require('mongoose');

const CategoryRequestSchema = new mongoose.Schema({
  shopkeeperId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shopkeeper', 
    required: true 
  },
  categoryName: { type: String, required: true, maxlength: 100 },
  description: { type: String },
  status: { 
    type: String, 
    default: 'pending', 
    enum: ['pending', 'approved', 'rejected'] 
  },
  rejectionReason: { type: String },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { 
  collection: 'category_requests',
  timestamps: false
});

module.exports = mongoose.model('CategoryRequest', CategoryRequestSchema);