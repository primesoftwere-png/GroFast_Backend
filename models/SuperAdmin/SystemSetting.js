// models/SystemSetting.js (Super Admin - Config)
const mongoose = require('mongoose');

const SystemSettingSchema = new mongoose.Schema({
  settingKey: { type: String, required: true, unique: true, maxlength: 100 },
  settingValue: { type: String, required: true },
  settingType: { 
    type: String, 
    default: 'string', 
    enum: ['string', 'number', 'boolean', 'json'] 
  },
  description: { type: String },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  updatedAt: { type: Date, default: Date.now }
}, { 
  collection: 'system_settings',
  timestamps: false
});

module.exports = mongoose.model('SystemSetting', SystemSettingSchema);