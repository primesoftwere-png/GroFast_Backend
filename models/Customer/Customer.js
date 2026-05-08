// models/Customer.js (Customer Panel - Profile)
const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  firstName: { type: String, required: true, maxlength: 100 },
  lastName: { type: String, maxlength: 100 },
  profileImage: { type: String, maxlength: 255 },
  dateOfBirth: { type: Date },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other'] 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'customers',
  timestamps: false
});

CustomerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CustomerProfile', CustomerSchema);