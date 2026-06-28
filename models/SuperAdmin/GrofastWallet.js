// models/SuperAdmin/GrofastWallet.js
const mongoose = require('mongoose');

const GrofastWalletSchema = new mongoose.Schema({
  balance: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
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
  collection: 'grofast_wallets',
  timestamps: false
});

GrofastWalletSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('GrofastWallet', GrofastWalletSchema);
