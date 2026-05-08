// models/Wishlist.js (Customer Panel - Favorites)
const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',  // Changed from 'Customer' to 'User'
    required: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  createdAt: { type: Date, default: Date.now }
}, { 
  collection: 'wishlist',
  timestamps: false
});

WishlistSchema.index({ customerId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', WishlistSchema);