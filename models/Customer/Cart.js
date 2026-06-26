// models/Cart.js (Customer Panel - Shopping Cart)
const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
      }
    }
  ],
  OrderId: {
    type: String,
    default: null
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  totalGST: {
    type: Number,
    default: 0
  }
}, { 
  collection: 'cart',
  timestamps: true
});

// Index for faster queries
CartSchema.index({ 'products.productId': 1 });

module.exports = mongoose.model('Cart', CartSchema);