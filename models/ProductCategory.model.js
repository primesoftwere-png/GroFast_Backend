// models/Category.js (Shared - Product Browsing)
const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  categoryName: { type: String, required: true, maxlength: 100 },
  categoryType: { type: String, enum: ['parent', 'child'], default: 'parent' },
  parentCategoryId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category' 
  },
  categoryImage: { type: String },
  description: { type: String },
  status: { 
    type: String, 
    default: 'active', 
    enum: ['active', 'inactive', 'pending'] 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'categories',
  timestamps: false
});

CategorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Category', CategorySchema);