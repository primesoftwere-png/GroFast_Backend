const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, maxlength: 15 },
  password: { type: String, required: true },  // Stores hashed password after hook
  userType: { 
    type: String, 
    required: true, 
    enum: ['customer', 'shopkeeper', 'delivery_boy', 'super_admin'] 
  },
  roleDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { 
    type: String, 
    default: 'pending', 
    enum: ['pending', 'active', 'inactive', 'blocked'] 
  },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null }
}, { 
  collection: 'users',
  timestamps: false
});

// Pre-save hook: Hash password if plaintext (new or modified)
UserSchema.pre('save', async function(next) {
  try {
    console.log('Pre-save hook triggered. isNew:', this.isNew, 'isModified password:', this.isModified('password'));
    console.log('Password before check:', this.password ? this.password.substring(0, 10) + '...' : 'empty');

    if (this.isNew || this.isModified('password')) {
      const bcryptPrefixRegex = /^\$2[ab]\$/;
      if (this.password && !this.password.match(bcryptPrefixRegex)) {
        console.log('Hashing password...');
        this.password = await bcrypt.hash(this.password, 12);
        console.log('Hashed password starts with:', this.password.substring(0, 7));
      } else {
        console.log('Password already hashed or invalid for hashing');
      }
    }
    this.updatedAt = Date.now();
    next();
  } catch (err) {
    console.error('Error in pre-save hook:', err);
    next(err);
  }
});

// Post-save hook for debugging (remove in production)
UserSchema.post('save', function(doc) {
  console.log('User saved:', doc._id, 'Password starts with:', doc.password ? doc.password.substring(0, 7) + '...' : 'empty');
});

// Methods remain consistent
UserSchema.methods.generateAuthToken = async function () {
  const user = this;
  const token = jwt.sign(
    { 
      _id: user._id.toString(), 
      role: user.userType 
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: "1d" }
  );
  return token;
};

UserSchema.methods.comparePassword = async function (password) {
  const isMatch = await bcrypt.compare(password, this.password);  // Compares against hashed password
  return isMatch;
};

UserSchema.statics.hashPassword = async function (password) {
  const hashedPassword = await bcrypt.hash(password, 12);  // Consistent salt rounds
  return hashedPassword;
};

UserSchema.statics.verifyAuthToken = async function (token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);