// models/Admin/SupportTicket.js
const mongoose = require('mongoose');

const SupportTicketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true,
    default: () => `TKT-${Date.now().toString().slice(-6)}`
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userType: { type: String, enum: ['customer', 'shopkeeper', 'deliveryBoy', 'admin'], default: 'customer' },
  subject: { type: String, required: true },
  description: { type: String },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  messages: [{
    from: { type: String, enum: ['user', 'admin'], required: true },
    message: { type: String, required: true },
    sentAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);
